<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BusinessProfileService;
use App\Services\ReportExportService;
use App\Services\ReportService;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ReportController extends Controller
{
    public function options(Request $r)
    {
        app(RentalController::class)->authorizeStaff($r);

        $types = ReportService::TYPES;
        $p = app(\App\Services\PermissionService::class);
        if ($p->enabled() && ! $p->can($r->user(), 'reports.finance')) {
            $types = array_diff_key($types, array_flip(['financial', 'outstanding_invoices', 'daily_transactions', 'deposit_history']));
        }
        return response()->json(['status' => true, 'data' => ['types' => $types, 'can_include_identity' => app(\App\Services\AccessService::class)->identity($r->user()), 'max_rows' => 20000, 'pdf_max_rows' => 500]]);
    }

    public function customerFilter(Request $r)
    {
        app(RentalController::class)->authorizeStaff($r);
        $f = $r->validate(['id' => ['nullable', 'integer', 'min:1'], 'q' => ['nullable', 'string', 'max:100']]);
        $q = DB::table('customer_tb');
        if (isset($f['id'])) {
            $q->where('ID', $f['id']);
        } elseif (! empty($f['q'])) {
            $q->where('full_name', 'like', '%'.$f['q'].'%');
        }

        return response()->json(['success' => true, 'data' => $q->orderBy('full_name')->limit(20)->get(['ID as id', 'full_name as text'])]);
    }

    public function build(Request $r, ReportService $service): array
    {
        app(RentalController::class)->authorizeStaff($r);
        $f = $r->validate(['q' => ['nullable', 'string', 'max:100'], 'overdue_only' => ['nullable', 'boolean'], 'type' => ['required', Rule::in(array_keys(ReportService::TYPES))], 'from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'], 'customer_id' => ['nullable', 'integer', 'min:1'], 'vehicle_id' => ['nullable', 'integer', 'min:1'], 'branch_id' => ['nullable', 'integer', 'min:1'], 'staff_id' => ['nullable', 'integer', 'min:1'], 'status' => ['nullable', 'string', 'max:40'], 'include_identity' => ['nullable', 'boolean'], 'page' => ['nullable', 'integer', 'min:1'], 'per_page' => ['nullable', 'integer', 'between:10,200']]);
        if (! empty($f['include_identity'])) {
            abort_unless(app(\App\Services\AccessService::class)->identity($r->user()), 403, 'Identity export permission is required.');
        }
        if ($f['type'] === 'customer_history' && empty($f['customer_id'])) {
            throw ValidationException::withMessages(['customer_id' => 'Select a customer for this report.']);
        }
        $f['from'] = $f['from'] ?? now(config('rental.timezone'))->startOfMonth()->toDateString();
        $f['to'] = $f['to'] ?? now(config('rental.timezone'))->toDateString();
        if ($f['to'] < $f['from']) {
            throw ValidationException::withMessages(['to' => 'End date cannot precede start date.']);
        }
        $columns = $service->columns($f['type'], ! empty($f['include_identity']));
        $permissions = app(\App\Services\PermissionService::class);
        if ($permissions->enabled() && ! $permissions->can($r->user(), 'reports.finance')) {
            $columns = array_values(array_diff($columns, ['Invoice Total', 'Amount Paid', 'Balance', 'Recognized Revenue', 'Subtotal', 'Tax', 'Discount', 'Additional Charges', 'Rental Cash Received', 'Deposit Received', 'Deposit Applied', 'Deposit Refunded', 'Deposit Held']));
        }
        $rows = [];
        $totals = [];
        $scanned = 0;
        foreach ($service->rows($f['type'], $f) as $row) {
            if (++$scanned > 50000) {
                throw ValidationException::withMessages(['filters' => 'Report scan exceeds 50,000 records. Narrow the date/entity filters.']);
            }
            if (count($rows) >= 20000) {
                throw ValidationException::withMessages(['filters' => 'This report exceeds 20,000 rows. Narrow the date/entity filters and export in batches.']);
            }$row = array_intersect_key($row, array_flip($columns));
            if (! empty($f['q']) && ! str_contains(mb_strtolower(implode(' ', array_map('strval', $row))), mb_strtolower($f['q']))) {
                continue;
            }
            $rows[] = $row;
            foreach ($row as $k => $v) {
                if (in_array($k, ReportService::NUMBERS, true) && is_numeric($v)) {
                    $totals[$k] = bcadd($totals[$k] ?? '0', number_format((float) $v, 3, '.', ''), 3);
                }
            }
        }

        return ['title' => ReportService::TYPES[$f['type']], 'columns' => $columns, 'rows' => $rows, 'totals' => array_map(fn ($v) => (float) $v, $totals), 'filters' => $f, 'generated_at' => now(config('rental.timezone'))->format('Y-m-d H:i:s'), 'timezone' => config('rental.timezone')];
    }

    public function getReport(Request $r, ReportService $service)
    {
        $report = $this->build($r, $service);
        $page = (int) ($report['filters']['page'] ?? 1);
        $size = (int) ($report['filters']['per_page'] ?? 50);
        $count = count($report['rows']);

        return response()->json(['status' => true, 'data' => array_slice($report['rows'], ($page - 1) * $size, $size), 'columns' => $report['columns'], 'totals' => $report['totals'], 'meta' => ['page' => $page, 'per_page' => $size, 'total' => $count, 'last_page' => max(1, (int) ceil($count / $size)), 'filters' => $report['filters'], 'title' => $report['title'], 'generated_at' => $report['generated_at']]])->header('Cache-Control', 'private, no-store');
    }

    public function export(Request $r, ReportService $service, ReportExportService $export)
    {
        $r->validate(['format' => ['required', Rule::in(['csv', 'xlsx', 'html', 'pdf'])]]);
        $report = $this->build($r, $service);
        $name = 'intelliride-'.$report['filters']['type'];
        $headers = ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff'];
        if ($r->input('format') === 'csv') {
            return response($export->csv($report), 200, [...$headers, 'Content-Type' => 'text/csv; charset=UTF-8', 'Content-Disposition' => 'attachment; filename="'.$name.'.csv"']);
        }
        if ($r->input('format') === 'xlsx') {
            return response()->download($export->xlsx($report), $name.'.xlsx', [...$headers, 'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])->deleteFileAfterSend(true);
        }
        if (count($report['rows']) > 500) {
            throw ValidationException::withMessages(['format' => 'Print and PDF support up to 500 rows. Narrow the filters or use Excel/CSV.']);
        }
        $company = app(BusinessProfileService::class)->snapshot();
        $html = view('reports.table', ['report' => $report, 'company' => $company, 'logo_size' => app(BusinessProfileService::class)->logoDimensions($company['logo_data'] ?? null, 160, 60)])->render();
        if ($r->input('format') === 'html') {
            return response($html, 200, [...$headers, 'Content-Type' => 'text/html; charset=UTF-8']);
        }
        $options = new Options;
        $options->set('isRemoteEnabled', false);
        $options->set('isPhpEnabled', false);
        $options->set('defaultMediaType', 'print');
        $pdf = new Dompdf($options);
        $pdf->loadHtml($html);
        $pdf->setPaper(count($report['columns']) > 12 ? 'A3' : 'A4', 'landscape');
        $pdf->render();

        return response($pdf->output(), 200, [...$headers, 'Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="'.$name.'.pdf"']);
    }
}

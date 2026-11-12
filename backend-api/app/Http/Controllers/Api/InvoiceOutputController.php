<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BusinessProfileService;
use App\Services\FinanceService;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InvoiceOutputController extends Controller
{
    public function output(Request $request, FinanceService $service)
    {
        app(RentalController::class)->authorizeStaff($request);
        $data = $request->validate(['invoice_id' => ['required', 'integer', 'min:1'], 'format' => ['required', Rule::in(['html', 'pdf'])]]);
        $invoice = DB::table('invoice_tb')->where('ID', $data['invoice_id'])->where('status', 'Issued')->first();
        abort_unless($invoice, 404, 'Issued invoice not found.');
        $invoice->snapshot = json_decode($invoice->snapshot, true);
        $invoice->summary = $service->summary($invoice);
        $receipts = DB::table('booking_payment_tb')->where('booking_id', $invoice->booking_id)->orderBy('ID')->get()->map(fn ($p) => ['source' => 'Booking advance', 'date' => $p->paid_on, 'method' => $p->method, 'reference' => $p->reference, 'amount' => $p->amount])->concat(DB::table('invoice_payment_tb')->where('invoice_id', $invoice->ID)->orderBy('ID')->get()->map(fn ($p) => ['source' => 'Invoice payment', 'date' => $p->paid_on, 'method' => $p->method, 'reference' => $p->reference, 'amount' => $p->amount]));
        $company = $invoice->snapshot['company'] ?? config('rental.company');
        $logo = $company['logo_data'] ?? app(BusinessProfileService::class)->logoData(null);
        $html = view('invoices.landscape', ['invoice' => $invoice, 'receipts' => $receipts, 'logo' => $logo, 'logo_size' => app(BusinessProfileService::class)->logoDimensions($logo, 190, 58), 'company' => $company, 'generated' => now(config('rental.timezone'))->format('Y-m-d H:i:s')])->render();
        $headers = ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff'];
        if ($data['format'] === 'html') {
            return response($html, 200, [...$headers, 'Content-Type' => 'text/html; charset=UTF-8']);
        }
        $options = new Options;
        $options->set('isRemoteEnabled', false);
        $options->set('isPhpEnabled', false);
        $options->set('isJavascriptEnabled', false);
        $options->set('defaultMediaType', 'print');
        $pdf = new Dompdf($options);
        $pdf->loadHtml($html);
        $pdf->setPaper('A4', 'landscape');
        $pdf->render();

        return response($pdf->output(), 200, [...$headers, 'Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="'.$invoice->summary['invoice_number'].'.pdf"']);
    }
}

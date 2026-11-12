<?php

namespace App\Services;

use RuntimeException;
use XMLWriter;
use ZipArchive;

class ReportExportService
{
    public function safeText($value): string
    {
        $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', (string) ($value ?? ''));

        return preg_match('/^[\s]*[=+\-@]/u', $s) ? "'".$s : $s;
    }

    public function csv(array $report): string
    {
        $stream = fopen('php://temp', 'w+');
        fwrite($stream, "\xEF\xBB\xBF");
        fputcsv($stream, $report['columns'], ',', '"', '');
        foreach ($report['rows'] as $row) {
            $values = [];
            foreach ($report['columns'] as $column) {
                $values[] = in_array($column, ReportService::NUMBERS, true) && is_numeric($row[$column] ?? null) ? $row[$column] : $this->safeText($row[$column] ?? '');
            }fputcsv($stream, $values, ',', '"', '');
        }rewind($stream);
        $result = stream_get_contents($stream);
        fclose($stream);

        return $result;
    }

    private function column(int $number): string
    {
        $result = '';
        while ($number > 0) {
            $number--;
            $result = chr(65 + $number % 26).$result;
            $number = intdiv($number, 26);
        }

        return $result;
    }

    public function xlsx(array $report): string
    {
        $folder = storage_path('app/private/exports');
        if (! is_dir($folder) && ! mkdir($folder, 0700, true) && ! is_dir($folder)) {
            throw new RuntimeException('Unable to create export directory.');
        }
        $sheet = tempnam($folder, 'sheet-');
        $file = tempnam($folder, 'report-');
        $xml = new XMLWriter;
        $xml->openUri($sheet);
        $xml->startDocument('1.0', 'UTF-8');
        $xml->startElement('worksheet');
        $xml->writeAttribute('xmlns', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        $xml->startElement('sheetViews');
        $xml->startElement('sheetView');
        $xml->writeAttribute('workbookViewId', '0');
        $xml->startElement('pane');
        foreach (['ySplit' => '1', 'topLeftCell' => 'A2', 'activePane' => 'bottomLeft', 'state' => 'frozen'] as $k => $v) {
            $xml->writeAttribute($k, $v);
        }$xml->endElement();
        $xml->endElement();
        $xml->endElement();
        $xml->startElement('cols');
        foreach ($report['columns'] as $index => $column) {
            $xml->startElement('col');
            foreach (['min' => $index + 1, 'max' => $index + 1, 'width' => 24, 'customWidth' => 1] as $k => $v) {
                $xml->writeAttribute($k, (string) $v);
            }$xml->endElement();
        }$xml->endElement();
        $xml->startElement('sheetData');
        $rows = [array_combine($report['columns'], $report['columns']), ...$report['rows']];
        $number = 0;
        foreach ($rows as $row) {
            $number++;
            $xml->startElement('row');
            $xml->writeAttribute('r', (string) $number);
            foreach ($report['columns'] as $index => $column) {
                $value = $row[$column] ?? null;
                $numeric = $number > 1 && $value !== null && in_array($column, ReportService::NUMBERS, true) && is_numeric($value);
                $xml->startElement('c');
                $xml->writeAttribute('r', $this->column($index + 1).$number);
                $xml->writeAttribute('s', $number === 1 ? '1' : ($numeric ? '2' : '0'));
                $xml->writeAttribute('t', $numeric ? 'n' : 'inlineStr');
                if ($numeric) {
                    $xml->writeElement('v', number_format((float) $value, 3, '.', ''));
                } else {
                    $xml->startElement('is');
                    $xml->writeElement('t', $number === 1 ? (string) $value : $this->safeText($value));
                    $xml->endElement();
                }$xml->endElement();
            }$xml->endElement();
        }$xml->endElement();
        $xml->startElement('autoFilter');
        $xml->writeAttribute('ref', 'A1:'.$this->column(count($report['columns'])).max(1, $number));
        $xml->endElement();
        $xml->endElement();
        $xml->endDocument();
        $xml->flush();
        $zip = new ZipArchive;
        if ($zip->open($file, ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Unable to create workbook.');
        }
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
        $zip->addFromString('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="IntelliRide Report" sheetId="1" r:id="rId1"/></sheets></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
        $zip->addFromString('xl/styles.xml', '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.###"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF102A48"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
        $zip->addFile($sheet, 'xl/worksheets/sheet1.xml');
        $zip->close();
        unlink($sheet);

        return $file;
    }
}

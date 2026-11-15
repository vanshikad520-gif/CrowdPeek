
package com.crowdpeek.backend.controller;

import com.crowdpeek.backend.entity.CrowdReport;
import com.crowdpeek.backend.repository.CrowdReportRepository;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/crowd")
@CrossOrigin(origins = "*")
public class CrowdReportController {

    private final CrowdReportRepository reportRepository;

    public CrowdReportController(CrowdReportRepository reportRepository) {
        this.reportRepository = reportRepository;
    }

    @PostMapping("/report")
    public CrowdReport submitReport(@RequestBody CrowdReport report) {
        return reportRepository.save(report);
    }

    @GetMapping("/my-reports")
    public List<CrowdReport> getMyReports(@RequestParam String email) {
        return reportRepository.findByUserEmailOrderByCreatedAtDesc(email);
    }
}

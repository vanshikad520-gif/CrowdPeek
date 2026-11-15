
package com.crowdpeek.backend.repository;

import com.crowdpeek.backend.entity.CrowdReport;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CrowdReportRepository extends JpaRepository<CrowdReport, Long> {

    List<CrowdReport> findByUserEmailOrderByCreatedAtDesc(String userEmail);
}

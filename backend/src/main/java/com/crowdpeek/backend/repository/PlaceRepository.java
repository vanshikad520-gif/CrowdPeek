package com.crowdpeek.backend.repository;

import com.crowdpeek.backend.entity.Place;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlaceRepository extends JpaRepository<Place, String> {
}
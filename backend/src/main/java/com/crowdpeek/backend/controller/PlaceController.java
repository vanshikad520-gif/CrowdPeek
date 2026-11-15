
package com.crowdpeek.backend.controller;

import com.crowdpeek.backend.entity.Place;
import com.crowdpeek.backend.repository.PlaceRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/places")
@CrossOrigin(origins = "*")
public class PlaceController {

    private final PlaceRepository placeRepository;

    public PlaceController(PlaceRepository placeRepository) {
        this.placeRepository = placeRepository;
    }

    // Get all places
    @GetMapping
    public List<Place> getAllPlaces() {
        return placeRepository.findAll();
    }

    // Get a single place by ID
    @GetMapping("/{id}")
    public Place getPlaceById(@PathVariable String id) {
        return placeRepository.findById(id).orElse(null);
    }
}

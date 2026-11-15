
package com.crowdpeek.backend;

import com.crowdpeek.backend.entity.Place;
import com.crowdpeek.backend.repository.PlaceRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner initData(PlaceRepository repository) {
        return args -> {

            if (repository.count() == 0) {

                String[][] places = {
                    {"sukhna-lake", "Sukhna Lake", "Parks", "Sector 1"},
                    {"rock-garden", "Rock Garden", "Parks", "Sector 1"},
                    {"rose-garden", "Rose Garden", "Parks", "Sector 16"},
                    {"leisure-valley", "Leisure Valley", "Parks", "Sector 10"},
                    {"elante-mall", "Elante Mall", "Shopping", "Industrial Area"},
                    {"sector-17-plaza", "Sector 17 Plaza", "Shopping", "Sector 17"},
                    {"pu-library", "Panjab University Library", "Education", "Sector 14"},
                    {"pgimer-opd", "PGIMER OPD", "Hospital", "Sector 12"},
                    {"isbt-sector-17", "ISBT Sector 17", "Transport", "Sector 17"},
                    {"chandigarh-railway", "Chandigarh Railway Station", "Transport", "Industrial Area"}
                };

                double[][] coordinates = {
                    {30.7421, 76.8188},
                    {30.7530, 76.8100},
                    {30.7410, 76.7820},
                    {30.7440, 76.7830},
                    {30.7050, 76.8010},
                    {30.7400, 76.7820},
                    {30.7600, 76.7680},
                    {30.7650, 76.7750},
                    {30.7410, 76.7790},
                    {30.6800, 76.8200}
                };

                for (int i = 0; i < places.length; i++) {
                    Place p = new Place();
                    p.setId(places[i][0]);
                    p.setName(places[i][1]);
                    p.setCategory(places[i][2]);
                    p.setSector(places[i][3]);
                    p.setLatitude(coordinates[i][0]);
                    p.setLongitude(coordinates[i][1]);

                    repository.save(p);
                }
            }
        };
    }
}

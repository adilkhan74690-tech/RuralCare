import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Phone, 
  Navigation, 
  CheckCircle, 
  Clock, 
  ShieldCheck, 
  MapPin, 
  ExternalLink,
  Filter,
  Check
} from 'lucide-react';
import { HealthcareFacility } from '../types';
import { calculateDistanceKm, estimateDriveMinutes } from '../utils/geoUtils';
import { BrutalBadge } from './ui/BrutalBadge';
import { BrutalButton } from './ui/BrutalButton';

interface HospitalDiscoveryProps {
  patientLocation: { latitude: number; longitude: number };
  facilities: HealthcareFacility[];
  selectedFacilityId?: string | null;
  searchRadiusKm: number;
  onRadiusChange: (radius: number) => void;
  onSelectFacility: (facility: HealthcareFacility) => void;
}

export const HospitalDiscovery: React.FC<HospitalDiscoveryProps> = ({
  patientLocation,
  facilities,
  selectedFacilityId,
  searchRadiusKm,
  onRadiusChange,
  onSelectFacility,
}) => {
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GOVT' | 'PRIVATE'>('ALL');

  // Calculate distance for all facilities, filter by radius & type, sort with Govt Priority
  const rankedFacilities = useMemo(() => {
    const listWithDistance = facilities.map((f) => {
      const distanceKm = calculateDistanceKm(
        patientLocation.latitude,
        patientLocation.longitude,
        f.latitude,
        f.longitude
      );
      return {
        ...f,
        calculatedDistanceKm: distanceKm,
        estimatedMinutes: estimateDriveMinutes(distanceKm),
      };
    });

    // Filter by search radius
    const withinRadius = listWithDistance.filter((f) => f.calculatedDistanceKm <= searchRadiusKm);

    // Filter by facility ownership type
    const filtered = withinRadius.filter((f) => {
      if (typeFilter === 'GOVT') return f.isGovernment;
      if (typeFilter === 'PRIVATE') return !f.isGovernment;
      return true;
    });

    // Sort: Government PHC, CHC, District Hospital priority, then by distance ascending
    return filtered.sort((a, b) => {
      // Priority weighting: Govt PHC/CHC/DH (score 1) vs Private (score 2)
      const aGovScore = a.isGovernment ? 0 : 1;
      const bGovScore = b.isGovernment ? 0 : 1;
      if (aGovScore !== bGovScore) return aGovScore - bGovScore;

      // Type priority within govt: PHC/CHC/DH prioritized
      const typeRank = (t: string) => {
        if (t === 'DH') return 1;
        if (t === 'CHC') return 2;
        if (t === 'PHC') return 3;
        if (t === 'SDH') return 4;
        return 5;
      };

      if (a.isGovernment && b.isGovernment) {
        const trDiff = typeRank(a.type) - typeRank(b.type);
        // If same type or close, prioritize distance
        if (Math.abs(a.calculatedDistanceKm - b.calculatedDistanceKm) > 5) {
          return a.calculatedDistanceKm - b.calculatedDistanceKm;
        }
        return trDiff || a.calculatedDistanceKm - b.calculatedDistanceKm;
      }

      return a.calculatedDistanceKm - b.calculatedDistanceKm;
    });
  }, [facilities, patientLocation, searchRadiusKm, typeFilter]);

  const radiusOptions = [5, 10, 25, 50];

  return (
    <div className="space-y-4">
      {/* Search Radius & Filter Controls */}
      <div className="p-4 bg-white border-2 border-black rounded-xl shadow-brutal space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-heading font-black text-black flex items-center gap-2">
              <Building2 className="w-4 h-4 text-black stroke-[2.5]" />
              <span>Verified Referral Facilities Directory</span>
            </h3>
            <p className="text-xs text-neutral-600 font-bold mt-0.5">
              Government PHC/CHC/District Hospitals prioritized • Official MoHFW registry verified
            </p>
          </div>

          {/* Radius Selector: 5, 10, 25, 50 km */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black text-neutral-700 mr-1">Radius:</span>
            {radiusOptions.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRadiusChange(r)}
                className={`px-3 py-1 text-xs font-black rounded-md border-2 border-black transition-all ${
                  searchRadiusKm === r
                    ? 'bg-yellow text-black shadow-brutal-xs translate-x-[-1px] translate-y-[-1px]'
                    : 'bg-cream text-neutral-700 hover:bg-white'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        {/* Ownership Type Filter: All / Govt Only / Private */}
        <div className="flex items-center gap-2 pt-2 border-t border-black/10">
          <span className="text-xs font-black text-neutral-600 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Show:</span>
          </span>
          <button
            type="button"
            onClick={() => setTypeFilter('ALL')}
            className={`px-2.5 py-0.5 text-xs font-bold rounded border ${
              typeFilter === 'ALL'
                ? 'bg-black text-white border-black font-black'
                : 'bg-white text-neutral-700 border-black/30 hover:border-black'
            }`}
          >
            All Facilities ({facilities.length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('GOVT')}
            className={`px-2.5 py-0.5 text-xs font-bold rounded border ${
              typeFilter === 'GOVT'
                ? 'bg-teal text-white border-black font-black'
                : 'bg-white text-neutral-700 border-black/30 hover:border-black'
            }`}
          >
            🏛️ Government Only (Priority)
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('PRIVATE')}
            className={`px-2.5 py-0.5 text-xs font-bold rounded border ${
              typeFilter === 'PRIVATE'
                ? 'bg-yellow text-black border-black font-black'
                : 'bg-white text-neutral-700 border-black/30 hover:border-black'
            }`}
          >
            🏢 Private Empanelled
          </button>
        </div>
      </div>

      {/* Facilities List */}
      <div className="space-y-3">
        {rankedFacilities.length === 0 ? (
          <div className="p-6 bg-cream border-2 border-dashed border-black/40 rounded-xl text-center space-y-2">
            <p className="text-sm font-black text-black">
              No verified healthcare facilities found within {searchRadiusKm} km radius.
            </p>
            <p className="text-xs text-neutral-600 font-bold">
              Try expanding your search radius to 25 km or 50 km to discover tertiary district centers.
            </p>
            <button
              onClick={() => onRadiusChange(50)}
              className="mt-2 px-3 py-1.5 bg-yellow border-2 border-black rounded text-xs font-black shadow-brutal-xs"
            >
              Expand Search Radius to 50 km
            </button>
          </div>
        ) : (
          rankedFacilities.map((fac) => {
            const isSelected = fac.id === selectedFacilityId;
            const osmDirectionsUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${patientLocation.latitude},${patientLocation.longitude}%3B${fac.latitude},${fac.longitude}`;

            return (
              <div
                key={fac.id}
                className={`p-4 bg-white border-2 border-black rounded-xl transition-all ${
                  isSelected
                    ? 'border-3 border-teal ring-4 ring-teal/20 shadow-brutal-md bg-teal/5'
                    : 'shadow-brutal hover:translate-x-[-1.5px] hover:translate-y-[-1.5px]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    {/* Header Badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-black uppercase rounded border border-black ${
                          fac.isGovernment
                            ? 'bg-teal text-white'
                            : 'bg-yellow text-black'
                        }`}
                      >
                        {fac.isGovernment ? '🏛️ Govt Facility' : '🏢 Private Empanelled'}
                      </span>

                      <span className="px-2 py-0.5 text-[10px] font-black rounded border border-black bg-cream text-black">
                        {fac.typeName}
                      </span>

                      <span className="px-2 py-0.5 text-[10px] font-bold rounded border border-black/30 bg-white text-neutral-600 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-teal stroke-[2.5]" />
                        <span>{fac.facilityCode}</span>
                      </span>

                      {fac.emergencyAvailable24x7 && (
                        <span className="px-2 py-0.5 text-[10px] font-black rounded border border-black bg-danger/20 text-danger-hover flex items-center gap-1">
                          <Clock className="w-3 h-3 stroke-[2.5]" />
                          <span>24x7 Emergency</span>
                        </span>
                      )}
                    </div>

                    {/* Facility Name & Distance */}
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-base font-heading font-black text-black">
                        {fac.name}
                      </h4>
                      <div className="shrink-0 text-right">
                        <span className="text-base font-heading font-black text-teal">
                          {fac.calculatedDistanceKm} km
                        </span>
                        <p className="text-[10px] text-neutral-600 font-bold">
                          ~{fac.estimatedMinutes} mins via vehicle
                        </p>
                      </div>
                    </div>

                    {/* Address */}
                    <p className="text-xs text-neutral-700 font-bold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      <span>{fac.address}, {fac.district} ({fac.pincode})</span>
                    </p>

                    {/* Capabilities Tags */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {fac.capabilities.map((cap, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-[10px] font-bold bg-cream border border-black/20 rounded text-neutral-800"
                        >
                          ✓ {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="mt-3 pt-3 border-t-2 border-black/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Call Direct Button */}
                    <a
                      href={`tel:${fac.phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-yellow hover:bg-yellow-hover text-black text-xs font-black shadow-brutal-xs transition-colors"
                      title="Initiate telephone call to hospital emergency desk"
                    >
                      <Phone className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Call Facility ({fac.phone})</span>
                    </a>

                    {/* OpenStreetMap Directions */}
                    <a
                      href={osmDirectionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border-2 border-black bg-cream hover:bg-white text-black text-xs font-bold shadow-brutal-xs transition-colors"
                      title="Open turn-by-turn driving directions in OpenStreetMap"
                    >
                      <Navigation className="w-3.5 h-3.5 stroke-[2]" />
                      <span>Directions</span>
                      <ExternalLink className="w-3 h-3 text-neutral-500" />
                    </a>
                  </div>

                  {/* Select for Referral Button */}
                  <button
                    type="button"
                    onClick={() => onSelectFacility(fac)}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border-2 border-black text-xs font-black shadow-brutal-xs transition-all ${
                      isSelected
                        ? 'bg-teal text-white cursor-default'
                        : 'bg-white hover:bg-teal hover:text-white text-black'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Destination Selected</span>
                      </>
                    ) : (
                      <>
                        <span>Select for Referral</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};


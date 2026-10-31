-- CreateTable
CREATE TABLE "emergency_incidents" (
    "id" TEXT NOT NULL,
    "incidentCode" TEXT NOT NULL,
    "patientId" TEXT,
    "patientDisplayId" TEXT,
    "patientName" TEXT NOT NULL,
    "isUnregistered" BOOLEAN NOT NULL DEFAULT false,
    "unregisteredPatientAge" INTEGER,
    "unregisteredGender" TEXT,
    "ashaWorkerId" TEXT NOT NULL,
    "ashaWorkerName" TEXT NOT NULL,
    "incidentTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workerLatitude" DOUBLE PRECISION,
    "workerLongitude" DOUBLE PRECISION,
    "patientLatitude" DOUBLE PRECISION,
    "patientLongitude" DOUBLE PRECISION,
    "locationType" TEXT NOT NULL DEFAULT 'same_as_worker',
    "manualAddress" TEXT,
    "village" TEXT,
    "landmark" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'urgent',
    "chiefComplaints" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "referralStatus" TEXT NOT NULL DEFAULT 'initiated',
    "facilityId" TEXT,
    "facilityName" TEXT,
    "facilityType" TEXT,
    "facilityPhone" TEXT,
    "facilityAddress" TEXT,
    "facilityDistanceKm" DOUBLE PRECISION,
    "contactAttempts" JSONB,
    "transportType" TEXT,
    "transportContact" TEXT,
    "transportNotes" TEXT,
    "dispatchConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "arrivedAt" TIMESTAMP(3),
    "handoverTo" TEXT,
    "handoverNotes" TEXT,
    "referralCode" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastModified" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emergency_incidents_incidentCode_key" ON "emergency_incidents"("incidentCode");

-- AddForeignKey
ALTER TABLE "emergency_incidents" ADD CONSTRAINT "emergency_incidents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

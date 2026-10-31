import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { BrutalButton } from '../components/ui/BrutalButton';
import { BrutalInput } from '../components/ui/BrutalInput';
import { BrutalSelect } from '../components/ui/BrutalSelect';
import { UserPlus, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Patient } from '../types';

interface AddPatientProps {
  onAddPatient: (patient: Patient) => Promise<void> | void;
}

export const AddPatient: React.FC<AddPatientProps> = ({ onAddPatient }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Generated standard ID
  const defaultDisplayId = `RC-2026-${Math.floor(100 + Math.random() * 900)}`;

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [village, setVillage] = useState('Ramgarh');
  const [contactNumber, setContactNumber] = useState('');
  const [chwAssigned, setChwAssigned] = useState(user?.name || 'Sarah Jenkins');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!age || Number(age) <= 0 || Number(age) > 120) newErrors.age = 'Enter a valid age (1-120)';
    if (!village.trim()) newErrors.village = 'Village selection is required';
    if (!contactNumber.trim()) newErrors.contactNumber = 'Contact number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const newPatient: Patient = {
      id: uuidv4(),
      patientId: defaultDisplayId,
      fullName: fullName.trim(),
      age: parseInt(age, 10),
      gender,
      village,
      contactNumber: contactNumber.trim(),
      chwAssigned,
      registrationDate: new Date().toISOString(),
      notes: notes.trim(),
      syncStatus: 'pending',
      version: 1,
      lastModified: new Date().toISOString(),
    };

    try {
      await onAddPatient(newPatient);
      navigate(`/app/patients/${newPatient.id}`);
    } catch (err) {
      console.error('Failed to register patient:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* 1. Header & Back */}
      <div className="flex items-center justify-between pb-4 border-b-2 border-black">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-black text-black hover:underline"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          <span>Back to Patients</span>
        </button>
      </div>

      {/* 2. Registration Form */}
      <form onSubmit={handleSubmit} className="p-6 sm:p-8 bg-white border-2 border-black rounded-xl shadow-brutal space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-black text-black">
            Register New Patient
          </h1>
          <p className="text-xs text-neutral-600 font-bold mt-0.5">
            Record patient demographics and assign a local field identifier
          </p>
        </div>

        {/* Assigned ID banner - Bold Sunflower Yellow */}
        <div className="p-4 bg-yellow border-2 border-black rounded-xl flex items-center justify-between shadow-brutal-xs">
          <div>
            <span className="text-[10px] font-heading font-black uppercase tracking-wider text-black block">
              Local Patient Identifier
            </span>
            <span className="text-lg font-mono font-black text-black">
              {defaultDisplayId}
            </span>
          </div>
          <span className="text-xs font-black text-black bg-white px-3 py-1 rounded-md border-2 border-black shadow-brutal-xs">
            Auto-generated
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BrutalInput
            label="Full Name"
            placeholder="e.g. Kamla Devi"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
            required
          />

          <BrutalInput
            label="Age (in years)"
            type="number"
            placeholder="e.g. 35"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            error={errors.age}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BrutalSelect
            label="Gender"
            value={gender}
            onChange={(e) => setGender(e.target.value as any)}
            options={[
              { value: 'Female', label: 'Female' },
              { value: 'Male', label: 'Male' },
              { value: 'Other', label: 'Other' },
            ]}
          />

          <BrutalSelect
            label="Village / Sector"
            value={village}
            onChange={(e) => setVillage(e.target.value)}
            options={[
              { value: 'Ramgarh', label: 'Ramgarh' },
              { value: 'Chandrapura', label: 'Chandrapura' },
              { value: 'Dhanbad South', label: 'Dhanbad South' },
              { value: 'Kolebira', label: 'Kolebira' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BrutalInput
            label="Contact Phone"
            placeholder="Mobile Number"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            error={errors.contactNumber}
            required
          />

          <BrutalSelect
            label="Assigned Health Worker"
            value={chwAssigned}
            onChange={(e) => setChwAssigned(e.target.value)}
            options={[
              { value: 'Sarah Jenkins', label: 'Sarah Jenkins (Current)' },
              { value: 'Anita Murmu', label: 'Anita Murmu' },
              { value: 'Dr. Alok Verma', label: 'Dr. Alok Verma' },
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-wider mb-1.5 text-black font-heading">
            Household Notes & Directions
          </label>
          <textarea
            className="brutal-input min-h-[85px] text-sm resize-y"
            placeholder="e.g. Near village well. Morning visits preferred."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="pt-4 border-t-2 border-black flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-xs font-black text-black hover:underline"
          >
            Cancel
          </button>

          <BrutalButton
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting}
            icon={<UserPlus className="w-4 h-4 stroke-[2.5]" />}
          >
            {isSubmitting ? 'Saving to Device...' : 'Register Patient'}
          </BrutalButton>
        </div>
      </form>
    </div>
  );
};

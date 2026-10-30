import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BrutalButton } from '../components/ui/BrutalButton';
import { BrutalInput } from '../components/ui/BrutalInput';
import { BrutalSelect } from '../components/ui/BrutalSelect';
import { BrutalBadge } from '../components/ui/BrutalBadge';
import { 
  Square, 
  Check, 
  Plus, 
  Calendar, 
  User,
  Filter
} from 'lucide-react';
import { Task, TaskPriority, Patient } from '../types';

interface TaskManagerProps {
  tasks: Task[];
  patients: Patient[];
  onToggleTask: (taskId: string) => Promise<void> | void;
  onAddTask: (task: Task) => Promise<void> | void;
}

export const TaskManager: React.FC<TaskManagerProps> = ({
  tasks,
  patients,
  onToggleTask,
  onAddTask,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'COMPLETED'>('PENDING');
  const [showAddForm, setShowAddForm] = useState(false);

  // New task form state
  const [title, setTitle] = useState('');
  const [patientId, setPatientId] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'COMPLETED') return t.completed;
    if (filter === 'PENDING') return !t.completed;
    if (filter === 'OVERDUE') return !t.completed && t.dueDate < todayStr;
    return true; // ALL
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const patient = patients.find((p) => p.id === patientId);

    const newTask: Task = {
      id: uuidv4(),
      title: title.trim(),
      patientId: patientId || undefined,
      patientName: patient ? patient.fullName : undefined,
      dueDate,
      priority,
      completed: false,
      assignedChw: 'Sarah Jenkins',
      category: 'Administrative',
      syncStatus: 'pending',
      version: 1,
      lastModified: new Date().toISOString(),
    };

    await onAddTask(newTask);
    setTitle('');
    setPatientId('');
    setShowAddForm(false);
  };

  const overdueCount = tasks.filter((t) => !t.completed && t.dueDate < todayStr).length;
  const pendingCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="w-full space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-black">
            Field Tasks
          </h1>
          <p className="text-xs sm:text-sm text-neutral-700 font-bold mt-0.5">
            Follow-up action items, nutrition drops, and visit schedules
          </p>
        </div>

        <BrutalButton
          variant="primary"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
        >
          {showAddForm ? 'Cancel' : 'New Task'}
        </BrutalButton>
      </div>

      {/* 2. Quick Add Task Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateTask}
          className="p-6 bg-white border-2 border-black rounded-xl shadow-brutal space-y-4"
        >
          <h3 className="font-heading font-black text-sm text-black uppercase tracking-wider border-b-2 border-black pb-2">
            Create Action Item
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BrutalInput
              label="Task Description"
              placeholder="e.g. Check blood pressure for Kamla Devi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <BrutalSelect
              label="Associated Patient (Optional)"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="">-- No specific patient --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.patientId})
                </option>
              ))}
            </BrutalSelect>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BrutalInput
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />

            <BrutalSelect
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              options={[
                { value: 'urgent', label: 'Urgent' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low / Routine' },
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t-2 border-black">
            <BrutalButton type="submit" variant="primary" size="sm">
              Save Task
            </BrutalButton>
          </div>
        </form>
      )}

      {/* 3. Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-black pb-3">
        <button
          onClick={() => setFilter('PENDING')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
            filter === 'PENDING'
              ? 'bg-yellow text-black border-2 border-black shadow-brutal-xs'
              : 'bg-white text-black hover:bg-cream border-2 border-black shadow-brutal-xs'
          }`}
        >
          Pending ({pendingCount})
        </button>

        {overdueCount > 0 && (
          <button
            onClick={() => setFilter('OVERDUE')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
              filter === 'OVERDUE'
                ? 'bg-danger text-black border-2 border-black shadow-brutal-xs'
                : 'bg-white text-danger hover:bg-cream border-2 border-black shadow-brutal-xs'
            }`}
          >
            Overdue ({overdueCount})
          </button>
        )}

        <button
          onClick={() => setFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
            filter === 'ALL'
              ? 'bg-yellow text-black border-2 border-black shadow-brutal-xs'
              : 'bg-white text-black hover:bg-cream border-2 border-black shadow-brutal-xs'
          }`}
        >
          All Tasks ({tasks.length})
        </button>

        <button
          onClick={() => setFilter('COMPLETED')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
            filter === 'COMPLETED'
              ? 'bg-forest text-white border-2 border-black shadow-brutal-xs'
              : 'bg-white text-black hover:bg-cream border-2 border-black shadow-brutal-xs'
          }`}
        >
          Completed
        </button>
      </div>

      {/* 4. Task Items List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="p-10 text-center bg-white border-2 border-black rounded-xl text-black font-bold text-sm shadow-brutal">
            No tasks found under this filter.
          </div>
        ) : (
          filteredTasks.map((t) => {
            const isOverdue = !t.completed && t.dueDate < todayStr;
            return (
              <div
                key={t.id}
                className={`p-4 bg-white border-2 border-black rounded-xl flex items-center justify-between gap-3 shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal transition-all ${
                  t.completed ? 'opacity-65 bg-cream/70' : ''
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <button
                    onClick={() => onToggleTask(t.id)}
                    className="mt-0.5 w-5 h-5 rounded border-2 border-black bg-white hover:bg-yellow flex items-center justify-center shrink-0 shadow-brutal-xs transition-colors"
                  >
                    {t.completed ? (
                      <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                    ) : null}
                  </button>

                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-black ${
                          t.completed ? 'line-through text-neutral-500' : 'text-black'
                        }`}
                      >
                        {t.title}
                      </span>
                      {isOverdue && (
                        <span className="px-2 py-0.5 bg-danger text-black border-2 border-black text-[10px] font-black rounded shadow-brutal-xs">
                          Overdue
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-700 font-bold">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-black" />
                        <span>Due {t.dueDate}</span>
                      </span>

                      {t.patientName && (
                        <>
                          <span>•</span>
                          <span className="text-black font-black">
                            {t.patientName}
                          </span>
                        </>
                      )}

                      <span>•</span>
                      <span className="capitalize">{t.priority} priority</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <BrutalBadge syncStatus={t.syncStatus} size="sm" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

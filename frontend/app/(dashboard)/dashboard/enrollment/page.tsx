'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { fadeInUp } from '@/lib/animations/framer-motion';
import { EnrollmentWizard } from '@/components/features/enrollment/EnrollmentWizard';
import { AdminEnrollment } from '@/components/features/enrollment/AdminEnrollment';
import { startEnrollment, startTeacherEnrollment, EnrollmentApiError } from '@/lib/api/enrollment';
import { GraduationCap, UserCircle, ShieldCheck, Fingerprint } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';

export default function EnrollmentPage() {
  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'admin'>('student');

  const handleStartEnrollment = async (data: {
    studentId?: number;
    teacherId?: number;
    deviceId: number;
    fingerId: number;
  }) => {
    const isTeacher = activeTab === 'teacher' && data.teacherId != null;
    try {
      const response = isTeacher
        ? await startTeacherEnrollment({
          teacher_id: data.teacherId!,
          device_id: data.deviceId,
          finger_id: data.fingerId,
        })
        : await startEnrollment({
          student_id: data.studentId!,
          device_id: data.deviceId,
          finger_id: data.fingerId,
        });

      toast.success(isTeacher ? 'Teacher Enrollment Started' : 'Enrollment Started', {
        description: isTeacher
          ? 'The device is now waiting for the teacher to place their finger for check-in/check-out.'
          : 'The device is now waiting for the student to place their finger.',
        duration: 5000,
      });

      return response;
    } catch (error) {
      console.error('Enrollment error:', error);

      if (error instanceof EnrollmentApiError) {
        if (error.statusCode === 503) {
          toast.error('Device Offline', {
            description: 'The selected device is currently offline or unreachable. Please try again later or select a different device.',
            duration: 7000,
          });
        } else if (error.statusCode === 404) {
          toast.error('Not Found', {
            description: isTeacher ? 'Device not found.' : 'Student or device not found. Please check your selections and try again.',
            duration: 5000,
          });
        } else if (error.code === 'STUDENT_NOT_ON_DEVICE' || (error.statusCode === 400 && !isTeacher)) {
          toast.error('Student Not Synced', {
            description: error.message || 'Student is not synced to this device. Please sync the student first in the device selection step.',
            duration: 6000,
          });
        } else if (error.code === 'TEACHER_NOT_ON_DEVICE' || (error.statusCode === 400 && isTeacher)) {
          toast.error('Teacher Not Synced', {
            description: error.message || 'Teacher is not synced to this device. Please sync the teacher first in the device selection step.',
            duration: 6000,
          });
        } else if (error.statusCode === 409) {
          toast.error('Enrollment In Progress', {
            description: 'An enrollment session is already in progress. Please wait for it to complete or cancel it first.',
            duration: 5000,
          });
        } else {
          toast.error('Enrollment Failed', {
            description: error.message || 'Failed to start enrollment. Please try again.',
            duration: 5000,
          });
        }
      } else {
        toast.error('Enrollment Failed', {
          description: error instanceof Error ? error.message : 'An unexpected error occurred during enrollment',
          duration: 5000,
        });
      }

      throw error;
    }
  };

  return (
    <div className="page-shell space-y-5">
      <PageHeader
        icon={Fingerprint}
        title="Enrollment"
        subtitle="Register fingerprints for students, teachers or admins on a connected device"
        actions={
          <div className="grid grid-cols-3 gap-0.5 rounded-xl border border-slate-200 bg-slate-100/80 p-0.5">
            {([
              { id: 'student', label: 'Student', icon: GraduationCap },
              { id: 'teacher', label: 'Teacher', icon: UserCircle },
              { id: 'admin', label: 'Admin', icon: ShieldCheck },
            ] as const).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all',
                  activeTab === t.id ? 'bg-white text-primary shadow-[var(--shadow-key-2)]' : 'text-slate-500 hover:text-slate-800'
                )}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        }
      />

          {activeTab === 'student' && (
            <EnrollmentWizard mode="student" onStartEnrollment={handleStartEnrollment} />
          )}
          {activeTab === 'teacher' && (
            <EnrollmentWizard mode="teacher" onStartEnrollment={handleStartEnrollment} />
          )}
          {activeTab === 'admin' && <AdminEnrollment />}
    </div>
  );
}

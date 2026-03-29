'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { fadeInUp } from '@/lib/animations/framer-motion';
import { EnrollmentWizard } from '@/components/features/enrollment/EnrollmentWizard';
import { startEnrollment, startTeacherEnrollment, EnrollmentApiError } from '@/lib/api/enrollment';
import { GraduationCap, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EnrollmentPage() {
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 w-full px-4 py-8 sm:px-6 lg:px-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
        >
          <div className="mb-6 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-1">
              Fingerprint Enrollment
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
              Register biometric data for students or teachers on connected scanners
            </p>
          </div>

          <div className="w-full max-w-sm mx-auto grid grid-cols-2 gap-2 mb-8 p-1 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50">
            <button
              type="button"
              onClick={() => setActiveTab('student')}
              className={cn(
                'flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-bold text-xs transition-all',
                activeTab === 'student'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
              )}
            >
              <GraduationCap className="size-3.5" />
              Student
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('teacher')}
              className={cn(
                'flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-bold text-xs transition-all',
                activeTab === 'teacher'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
              )}
            >
              <UserCircle className="size-3.5" />
              Teacher
            </button>
          </div>
          {activeTab === 'student' && (
            <EnrollmentWizard mode="student" onStartEnrollment={handleStartEnrollment} />
          )}
          {activeTab === 'teacher' && (
            <EnrollmentWizard mode="teacher" onStartEnrollment={handleStartEnrollment} />
          )}
        </motion.div>
      </div>
    </div>
  );
}

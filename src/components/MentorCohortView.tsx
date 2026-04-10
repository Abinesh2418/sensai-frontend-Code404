"use client";

import { useState, useEffect } from "react";
import { Course, CohortWithDetails, CohortMember } from "@/types";
import CohortDashboard from "@/components/CohortDashboard";
import LearnerCohortView from "@/components/LearnerCohortView";
import { Module } from "@/types/course";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, Users, ClipboardList, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";

interface TaskTypeMetrics {
    completion_rate: number;
    count: number;
    completions: Record<string, number>;
}

// Course metrics interface
interface CourseMetrics {
    average_completion: number;
    num_tasks: number;
    num_active_learners: number;
    task_type_metrics: {
        quiz?: TaskTypeMetrics;
        learning_material?: TaskTypeMetrics;
        exam?: TaskTypeMetrics;
    };
}

interface MentorCohortViewProps {
    cohort: CohortWithDetails;
    activeCourseIndex?: number; // now optional
    schoolId: string;
    onActiveCourseChange?: (index: number) => void; // new
    batchId?: number | null; // new
    // Props for LearnerCohortView
    courseModules?: Module[];
    completedTaskIds?: Record<string, boolean>;
    completedQuestionIds?: Record<string, Record<string, boolean>>;
    courses?: Course[];
}

export default function MentorCohortView({
    cohort,
    activeCourseIndex = 0, // default to 0
    schoolId,
    onActiveCourseChange,
    batchId, // new
    courseModules = [],
    completedTaskIds = {},
    completedQuestionIds = {},
    courses = [],
}: MentorCohortViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Get view mode from URL params, default to 'mentor'
    const urlView = searchParams.get('view');
    const isValidViewMode = (view: string | null): view is 'mentor' | 'learner' | 'reviews' => {
        return view === 'mentor' || view === 'learner' || view === 'reviews';
    };
    const defaultView = isValidViewMode(urlView) ? urlView : 'mentor';
    const [viewMode, setViewMode] = useState<'mentor' | 'learner' | 'reviews'>(defaultView);

    // Sync viewMode with URL changes
    useEffect(() => {
        const urlView = searchParams.get('view');
        if (isValidViewMode(urlView) && urlView !== viewMode) {
            setViewMode(urlView);
        }
    }, [searchParams, viewMode]);

    // Update URL when view mode changes
    const updateUrlWithViewMode = (mode: 'mentor' | 'learner') => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('view', mode);
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    // Handle view mode toggle
    const handleViewModeToggle = (mode: 'mentor' | 'learner' | 'reviews') => {
        setViewMode(mode);
        updateUrlWithViewMode(mode);
    };

    // Show placeholder if batchId === null
    if (batchId === null) {
        return (
            <div className="flex flex-col items-center justify-center py-20 flex-1">
                <h2 className="text-4xl font-light mb-4 text-black dark:text-white">No learners assigned yet</h2>
                <p className="text-gray-400 mb-8">You will see their progress here once they are assigned to you</p>
            </div>
        );
    }

    // State for cohort members
    const [cohortMembers, setCohortMembers] = useState<CohortMember[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(true);
    const [membersError, setMembersError] = useState<string | null>(null);
    const [schoolSlug, setSchoolSlug] = useState<string>('');

    useEffect(() => {
        const fetchCohortMembers = async () => {
            if (!cohort?.id) return;
            setIsLoadingMembers(true);
            setMembersError(null);
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/${cohort.id}?batch_id=${batchId}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch cohort members: ${response.status}`);
                }
                const data = await response.json();
                setCohortMembers(data.members);
            } catch (error) {
                setMembersError("Failed to load cohort members.");
            } finally {
                setIsLoadingMembers(false);
            }
        };
        const fetchSchoolSlug = async () => {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${schoolId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch school details: ${response.status}`);
            }
            const data = await response.json();
            setSchoolSlug(data.slug);
        };
        fetchCohortMembers();
        fetchSchoolSlug();
    }, [cohort?.id, batchId]);

    if (isLoadingMembers) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-12 h-12 border-t-2 rounded-full animate-spin border-black dark:border-white"></div>
            </div>
        );
    }
    if (membersError) {
        return (
            <div className="flex flex-col items-center justify-center p-8 border border-red-800 rounded-lg bg-red-900/20">
                <p className="text-red-400 mb-2">{membersError}</p>
            </div>
        );
    }

    // Merge members into cohort object, preserving all CohortWithDetails properties
    const cohortWithMembers = { ...cohort, members: cohortMembers };

    return (
        <div className="w-full">
            {/* View Mode Toggle */}
            <div className="flex justify-center mb-8">
                <div className="rounded-full p-1 flex items-center bg-gray-200 dark:bg-[#333333]">
                    <button
                        onClick={() => handleViewModeToggle('mentor')}
                        className={`flex items-center px-4 py-2 rounded-full text-sm font-light transition-all cursor-pointer ${viewMode === 'mentor'
                            ? 'bg-white text-black'
                            : 'text-gray-700 dark:text-white hover:bg-gray-300 dark:hover:bg-black'
                            }`}
                    >
                        <Users size={16} className="mr-2" />
                        Mentor View
                    </button>
                    <button
                        onClick={() => handleViewModeToggle('learner')}
                        className={`flex items-center px-4 py-2 rounded-full text-sm font-light transition-all cursor-pointer ${viewMode === 'learner'
                            ? 'bg-white text-black'
                            : 'text-gray-700 dark:text-white hover:bg-gray-300 dark:hover:bg-black'
                            }`}
                    >
                        <Eye size={16} className="mr-2" />
                        Learner View
                    </button>
                    <button
                        onClick={() => handleViewModeToggle('reviews')}
                        className={`flex items-center px-4 py-2 rounded-full text-sm font-light transition-all cursor-pointer ${viewMode === 'reviews'
                            ? 'bg-white text-black'
                            : 'text-gray-700 dark:text-white hover:bg-gray-300 dark:hover:bg-black'
                            }`}
                    >
                        <ClipboardList size={16} className="mr-2" />
                        Reviews
                    </button>
                </div>
            </div>

            {/* Render appropriate view */}
            {viewMode === 'mentor' ? (
                <CohortDashboard
                    cohort={cohortWithMembers}
                    cohortId={cohort.id.toString()}
                    schoolId={schoolId}
                    schoolSlug={schoolSlug}
                    view="mentor"
                    activeCourseIndex={activeCourseIndex}
                    onActiveCourseChange={onActiveCourseChange}
                    batchId={batchId}
                />
            ) : viewMode === 'reviews' ? (
                <ReadyForEvaluation schoolSlug={schoolSlug} cohortId={cohort.id} batchId={batchId} />
            ) : (
                <LearnerCohortView
                    courseTitle={courses.length > 1 ? "" : courses[activeCourseIndex]?.name || ""}
                    modules={courseModules}
                    schoolId={schoolId}
                    cohortId={cohort.id.toString()}
                    streakDays={2}
                    activeDays={["M", "T"]}
                    completedTaskIds={completedTaskIds}
                    completedQuestionIds={completedQuestionIds}
                    courses={courses}
                    onCourseSelect={onActiveCourseChange}
                    activeCourseIndex={activeCourseIndex}
                />
            )}
        </div>
    );
}


// ─── Ready for Evaluation Component ──────────────────────────────────────────

interface ReadyForEvaluationProps {
    schoolSlug: string;
    cohortId: number;
    batchId?: number | null;
}

interface Submission {
    user_id: number;
    user_name: string;
    task_id: number;
    task_title: string;
    questions_answered: number;
    submitted_at: string | null;
}

function ReadyForEvaluation({ schoolSlug, cohortId, batchId }: ReadyForEvaluationProps) {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSubmissions = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (cohortId) params.set("cohort_id", String(cohortId));
            if (batchId) params.set("batch_id", String(batchId));
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/evaluations/ready-for-evaluation?${params}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setSubmissions(data);
        } catch {
            setError("Failed to load submissions");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubmissions();
    }, [cohortId, batchId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-gray-400 dark:text-zinc-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3">{error}</p>
                <button onClick={fetchSubmissions} className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">Retry</button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-light text-gray-900 dark:text-white">Ready for Evaluation</h2>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                        {submissions.length} submission{submissions.length !== 1 ? 's' : ''} awaiting evaluation
                    </p>
                </div>
                <button onClick={fetchSubmissions} className="text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300 cursor-pointer">
                    Refresh
                </button>
            </div>

            {submissions.length === 0 ? (
                <div className="text-center py-8">
                    <ClipboardList size={32} className="mx-auto text-gray-300 dark:text-zinc-600 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-zinc-400">No submissions awaiting evaluation</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {submissions.map(s => (
                        <Link
                            key={`${s.user_id}-${s.task_id}`}
                            href={`/school/${schoolSlug}/evaluation/${s.user_id}/${s.task_id}`}
                            className="flex items-center justify-between p-5 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="text-base font-medium text-gray-900 dark:text-white">{s.user_name}</span>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                        Ready to Evaluate
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-zinc-400">{s.task_title}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-zinc-500">
                                    <span>{s.questions_answered} question{s.questions_answered !== 1 ? 's' : ''} answered</span>
                                    {s.submitted_at && <span>{new Date(s.submitted_at).toLocaleDateString()}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-gray-900 text-white dark:bg-white dark:text-gray-900">
                                    Evaluate
                                </span>
                                <ChevronRight size={16} className="text-gray-400 dark:text-zinc-500" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
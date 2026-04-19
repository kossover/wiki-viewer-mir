import { adminDb } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
    params: Promise<{ token: string }>;
};

async function getMeetingByToken(token: string) {
    if (!token) return null;

    try {
        const linkDoc = await adminDb.collection('meeting_share_links').doc(token).get();
        if (!linkDoc.exists) return { error: 'Invalid or expired link' };

        const linkData = linkDoc.data();
        if (!linkData || !linkData.active) return { error: 'Link is not active' };

        const meetingDoc = await adminDb.collection('meetings').doc(linkData.meetingId).get();
        if (!meetingDoc.exists) return { error: 'Meeting not found' };

        const convertTimestamps = (data: any): any => {
            if (!data) return data;
            if (data.toDate && typeof data.toDate === 'function') return data.toDate().toISOString();
            if (Array.isArray(data)) return data.map(convertTimestamps);
            if (typeof data === 'object') {
                const out: any = {};
                for (const key in data) out[key] = convertTimestamps(data[key]);
                return out;
            }
            return data;
        };

        return { meeting: { id: meetingDoc.id, ...convertTimestamps(meetingDoc.data()) } };
    } catch (error) {
        console.error('Error retrieving meeting share:', error);
        return { error: 'Internal server error' };
    }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { token } = await props.params;
    const result = await getMeetingByToken(token);
    if (!result || result.error || !result.meeting) return { title: 'סיכום פגישה' };
    return {
        title: `סיכום פגישה: ${(result.meeting as any).title}`,
        robots: { index: false, follow: false },
    };
}

export default async function MeetingViewerPage(props: Props) {
    const { token } = await props.params;
    const result = await getMeetingByToken(token);

    if (!result || result.error || !result.meeting) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">!</div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">הפגישה לא נמצאה</h1>
                    <p className="text-gray-500">{result?.error || 'הקישור אינו תקף.'}</p>
                </div>
            </div>
        );
    }

    const m = result.meeting as any;
    const dateStr = m.date
        ? new Date(m.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';

    const openTasksCount = (m.tasks || []).filter((t: any) => t.status !== 'completed').length;
    const doneTasksCount = (m.tasks || []).filter((t: any) => t.status === 'completed').length;

    return (
        <div dir="rtl" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", minHeight: '100vh', backgroundColor: '#F1F5F9', padding: '0' }}>
            {/* Header */}
            <div style={{ backgroundColor: '#032D3F', padding: '20px 16px', borderBottom: '4px solid #F9B233', textAlign: 'center' }}>
                <img src="/logo.png" alt="MIR Logo" style={{ height: '40px', objectFit: 'contain', marginBottom: '12px' }} />
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                    סיכום פגישה: {m.title}
                </h1>
                <p style={{ margin: '8px 0 0', color: '#CCDFE8', fontSize: '14px' }}>תאריך: {dateStr}</p>
                {(m.locationType || m.locationDetails) && (
                    <p style={{ margin: '4px 0 0', color: '#94A3B8', fontSize: '13px' }}>
                        {m.locationType === 'zoom' ? '📹 זום' : m.locationType === 'physical' ? '📍 פגישה פיזית' : ''}{m.locationDetails ? ` — ${m.locationDetails}` : ''}
                    </p>
                )}
            </div>

            <div style={{ maxWidth: '720px', margin: '0 auto', padding: '16px' }}>

                {/* Stats bar */}
                {(m.tasks && m.tasks.length > 0) && (
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '120px', background: '#fff', borderRadius: '10px', padding: '12px 16px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                            <div style={{ fontSize: '24px', fontWeight: 700, color: '#F9B233' }}>{openTasksCount}</div>
                            <div style={{ fontSize: '12px', color: '#64748B' }}>משימות פתוחות</div>
                        </div>
                        <div style={{ flex: 1, minWidth: '120px', background: '#fff', borderRadius: '10px', padding: '12px 16px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                            <div style={{ fontSize: '24px', fontWeight: 700, color: '#6F9B78' }}>{doneTasksCount}</div>
                            <div style={{ fontSize: '12px', color: '#64748B' }}>משימות שבוצעו</div>
                        </div>
                        {m.attendees && m.attendees.length > 0 && (
                            <div style={{ flex: 1, minWidth: '120px', background: '#fff', borderRadius: '10px', padding: '12px 16px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: 700, color: '#2F5F73' }}>{m.attendees.length}</div>
                                <div style={{ fontSize: '12px', color: '#64748B' }}>משתתפים</div>
                            </div>
                        )}
                    </div>
                )}

                {/* Agenda */}
                {m.agenda && (
                    <Section title="אג'נדה ומטרה" borderColor="#0B3F55">
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: '15px', color: '#334155', lineHeight: 1.6 }}>{m.agenda}</div>
                    </Section>
                )}

                {/* Summary */}
                {m.summary && (
                    <Section title="סיכום הפגישה" borderColor="#2F5F73">
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: '15px', color: '#334155', lineHeight: 1.6 }}>{m.summary}</div>
                    </Section>
                )}

                {/* Topics */}
                {m.topics && m.topics.length > 0 && (
                    <Section title="נושאים שנידונו" borderColor="#0B3F55">
                        <ul style={{ paddingRight: '20px', margin: 0 }}>
                            {m.topics.map((t: any, i: number) => (
                                <li key={i} style={{ marginBottom: '8px', fontSize: '15px', color: t.isHighlighted ? '#8B3A3A' : '#334155', fontWeight: t.isHighlighted ? 700 : 400 }}>
                                    {t.text}{t.isHighlighted ? ' ⭐' : ''}
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {/* Tasks */}
                {m.tasks && m.tasks.length > 0 && (
                    <Section title="משימות לביצוע (Action Items)" borderColor="#F9B233">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {m.tasks.map((t: any, i: number) => {
                                const isDone = t.status === 'completed';
                                return (
                                    <div key={i} style={{
                                        borderRadius: '8px',
                                        border: '1px solid #E2E8F0',
                                        borderRight: `4px solid ${isDone ? '#6F9B78' : '#F9B233'}`,
                                        backgroundColor: isDone ? '#F8FAFC' : '#fff',
                                        padding: '12px 14px',
                                    }}>
                                        <div style={{
                                            fontSize: '15px',
                                            fontWeight: 600,
                                            color: isDone ? '#94A3B8' : '#0F172A',
                                            textDecoration: isDone ? 'line-through' : 'none',
                                            marginBottom: '6px',
                                        }}>{t.text}</div>
                                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: '#64748B', alignItems: 'center' }}>
                                            {t.assignee && <span>👤 {t.assignee}</span>}
                                            {t.relatedClient && <span>🏢 {t.relatedClient}</span>}
                                            <span style={{ fontWeight: 700, color: isDone ? '#6F9B78' : '#B45309' }}>
                                                {isDone ? '✓ בוצע' : '● פתוח'}
                                            </span>
                                            {t.linkedTicketId && (
                                                <a href={`https://mirisrael.freshdesk.com/a/tickets/${t.linkedTicketId}`}
                                                    target="_blank" rel="noopener noreferrer"
                                                    style={{ color: '#2F5F73', textDecoration: 'underline' }}>
                                                    #{t.linkedTicketId}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Section>
                )}

                {/* Attendees */}
                {m.attendees && m.attendees.length > 0 && (
                    <Section title="משתתפים" borderColor="#0B3F55">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {m.attendees.map((a: string, i: number) => (
                                <span key={i} style={{
                                    display: 'inline-block',
                                    backgroundColor: '#E6F0F4',
                                    color: '#032D3F',
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                }}>{a}</span>
                            ))}
                        </div>
                    </Section>
                )}
            </div>

            {/* Footer */}
            <div style={{ backgroundColor: '#0F172A', padding: '16px', textAlign: 'center', fontSize: '12px', color: '#94A3B8', marginTop: '24px' }}>
                נשלח ממערכת מיר - Integral Management
            </div>
        </div>
    );
}

function Section({ title, borderColor, children }: { title: string; borderColor: string; children: React.ReactNode }) {
    return (
        <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            borderTop: `3px solid ${borderColor}`,
            padding: '16px',
            marginBottom: '16px',
        }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700, color: '#032D3F' }}>{title}</h3>
            {children}
        </div>
    );
}

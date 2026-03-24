import { adminDb } from '@/lib/firebase-admin';
import { generateHTML } from '@/utils/wikiHtmlGenerator';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

type Props = {
    params: Promise<{ token: string }>
};

async function getSharedPageByToken(token: string) {
    if (!token) return null;

    try {
        console.log('Fetching token:', token);
        const linkDoc = await adminDb.collection('wiki_shared_links').doc(token).get();
        console.log('linkDoc exists?', linkDoc.exists);

        if (!linkDoc.exists) {
            return { error: 'Invalid or expired link' };
        }

        const linkData = linkDoc.data();
        if (!linkData || !linkData.active) {
            return { error: 'Link is not active' };
        }

        const pageId = linkData.pageId;
        const pageDoc = await adminDb.collection('wiki_pages').doc(pageId).get();

        if (!pageDoc.exists) {
            return { error: 'Original page not found' };
        }

        const rawPageData = pageDoc.data();

        // Recursively convert timestamps to avoid Next.js serialization issues
        const convertTimestamps = (data: any): any => {
            if (!data) return data;
            if (data.toDate && typeof data.toDate === 'function') {
                return data.toDate().toISOString();
            }
            if (Array.isArray(data)) {
                return data.map(convertTimestamps);
            }
            if (typeof data === 'object') {
                const newData: any = {};
                for (const key in data) {
                    newData[key] = convertTimestamps(data[key]);
                }
                return newData;
            }
            return data;
        };

        const pageData = convertTimestamps(rawPageData);

        return {
            page: {
                id: pageDoc.id,
                ...pageData
            },
            linkInfo: convertTimestamps(linkData)
        };

    } catch (error) {
        console.error('Error retrieving shared page:', error);
        return { error: 'Internal server error' };
    }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const params = await props.params;
    const { token } = params;
    const result = await getSharedPageByToken(token);

    if (!result || result.error || !result.page) {
        return {
            title: 'Shared Document Not Found',
        };
    }

    return {
        title: `${(result.page as any).title} - Shared Document`,
        robots: {
            index: false,
            follow: false,
        }
    };
}

export default async function PublicWikiPage(props: Props) {
    const params = await props.params;
    const { token } = params;

    const result = await getSharedPageByToken(token);

    if (!result || result.error || !result.page) {
        if (result?.error === 'Original page not found') {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl font-bold">!</span>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">המסמך לא נמצא</h1>
                        <p className="text-gray-500">המסמך המקורי הוסר או שאינו קיים יותר.</p>
                    </div>
                </div>
            );
        }
        return notFound();
    }

    const page = result.page as any;

    const htmlContent = generateHTML(page, '/logo.png');

    return (
        <div
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            className="min-h-screen bg-gray-50 flex justify-center"
        />
    );
}

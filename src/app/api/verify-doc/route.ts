import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { token, docId, username, password } = body;

        // Verify token
        const linkDoc = await adminDb.collection('wiki_shared_customer_links').doc(token).get();
        if (!linkDoc.exists) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

        const linkData = linkDoc.data();
        if (!linkData || !linkData.active) return NextResponse.json({ error: 'Link inactive' }, { status: 400 });

        const authType = linkData.authType || 'none';

        if (authType === 'fixed') {
            if (password !== linkData.fixedPassword) {
                return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
            }
        } else if (authType === 'contacts') {
            // Need to verify against customer contacts
            // Find a wiki_page block of type 'contact' with matching email and phone
            const customerId = linkData.customerId;
            const pagesSnapshot = await adminDb.collection('wiki_pages')
                .where('parentId', '==', `customer-${customerId}`)
                .get();

            let authenticated = false;
            for (const doc of pagesSnapshot.docs) {
                const data = doc.data();
                if (data.blocks && Array.isArray(data.blocks)) {
                    for (const b of data.blocks) {
                        if (b.type === 'contact' && b.content?.email === username && b.content?.phone === password) {
                            authenticated = true;
                            break;
                        }
                    }
                }
                if (authenticated) break;
            }

            if (!authenticated) {
                return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
            }
        } else if (authType !== 'none') {
            return NextResponse.json({ error: 'Unknown auth method' }, { status: 400 });
        }

        // Fetch the specific document content
        const docSnapshot = await adminDb.collection('wiki_pages').doc(docId).get();
        if (!docSnapshot.exists) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

        const docData = docSnapshot.data();
        const blocks = docData?.blocks || [];

        // Helper function to match the one in page.tsx
        const isLight = (hex: string) => {
            if (!hex) return true;
            const c = hex.substring(1);
            const rgb = parseInt(c, 16);
            const r = (rgb >> 16) & 0xff;
            const g = (rgb >> 8) & 0xff;
            const b = (rgb >> 0) & 0xff;
            return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 180;
        };

        const renderBlock = (b: any) => {
            if (b.type === 'header') return `<h${b.content.level || 2} id="block-${b.id}" class="text-2xl font-bold my-4 pb-2 border-b" style="font-size: 1.5rem; font-weight: bold; margin: 16px 0; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${b.content.text}</h${b.content.level || 2}>`;
            if (b.type === 'text') return `<div class="prose max-w-none my-2 whitespace-pre-wrap">${b.content.text}</div>`;
            if (b.type === 'code') return `<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg my-2 overflow-x-auto" dir="ltr"><code>${b.content.code}</code></pre>`;

            if (b.type === 'colorPalette') {
                const colors = b.content.colors || [];
                const colorItems = colors.map((c: any) => `
                    <div class="flex flex-col rounded-lg overflow-hidden border border-gray-100 shadow-sm">
                        <div class="h-24 w-full flex items-center justify-center text-white font-mono text-sm shadow-inner" style="background-color: ${c.hex}; color: ${isLight(c.hex) ? '#333' : '#fff'}">
                            ${c.hex}
                        </div>
                        <div class="p-3 bg-white">
                            <div class="font-bold text-gray-800 text-sm">${c.name}</div>
                            ${c.label ? `<div class="text-xs text-gray-400">${c.label}</div>` : ''}
                        </div>
                    </div>`).join('');
                return `<div class="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">${colorItems}</div>`;
            }

            if (b.type === 'contact') {
                const { name, role, email, phone, notes } = b.content;
                return `
                    <div class="flex flex-col sm:flex-row gap-6 p-6 bg-white border border-gray-200 rounded-xl shadow-sm my-4">
                        <div class="flex-shrink-0 flex justify-center sm:justify-start">
                            <div class="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xl">
                                ${name ? name.charAt(0) : '?'}
                            </div>
                        </div>
                        <div class="flex-1 space-y-2 text-center sm:text-right">
                            <h3 class="text-xl font-bold text-gray-900">${name || 'No Name'}</h3>
                            <div class="text-blue-600 font-medium">${role || 'No Role'}</div>
                            <div class="text-sm text-gray-600 border-t pt-2 mt-2">
                                ${email ? `<div>Email: <a href="mailto:${email}" class="text-blue-600">${email}</a></div>` : ''}
                                ${phone ? `<div>Phone: <a href="tel:${phone}" class="text-blue-600">${phone}</a></div>` : ''}
                            </div>
                            ${notes ? `<div class="text-sm text-gray-500 bg-gray-50 p-2 rounded mt-2">${notes}</div>` : ''}
                        </div>
                    </div>`;
            }

            if (b.type === 'connection') {
                const { target, software, address, port, username, password, users, notes } = b.content;
                const userList = (users || [{ username, password }]).map((u: any) =>
                    `<div class="flex justify-between bg-gray-50 p-2 rounded mb-1 text-sm border border-gray-100">
                        <span class="font-mono text-gray-700 select-all">${u.username}</span>
                        <span class="font-mono text-gray-400 italic">********</span>
                    </div>`
                ).join('');

                return `
                    <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden my-4">
                        <div class="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100">
                            <div class="font-bold text-gray-900">${target || 'Connection'}</div>
                            <div class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${software}</div>
                        </div>
                        <div class="p-4 space-y-4">
                            <div>
                                <div class="text-xs font-semibold text-gray-400 uppercase">SERVER ADDRESS</div>
                                <code class="bg-gray-100 px-2 py-1 rounded text-gray-700 font-mono text-sm block mt-1 select-all" dir="ltr">${address}${port ? ':' + port : ''}</code>
                            </div>
                            <div>
                                <div class="text-xs font-semibold text-gray-400 uppercase mb-2">CREDENTIALS</div>
                                ${userList}
                            </div>
                            ${notes ? `<div class="text-sm text-gray-500 bg-gray-50 p-3 rounded border-t border-gray-100">${notes}</div>` : ''}
                        </div>
                    </div>`;
            }

            if (b.type === 'image') {
                const { url, caption, position, size, width, annotations = [] } = b.content;
                let sizeClass = 'max-w-md';
                switch (size) {
                    case 'small': sizeClass = 'max-w-xs'; break;
                    case 'medium': sizeClass = 'max-w-md'; break;
                    case 'large': sizeClass = 'max-w-3xl'; break;
                    case 'full': sizeClass = 'w-full'; break;
                }
                if (width) sizeClass = '';

                const containerClass = `my-6 flex gap-6 items-start ${position === 'left' ? 'flex-row' : position === 'right' ? 'flex-row-reverse' : 'flex-col items-center'}`;
                const imgStyle = width ? `width: ${width}px;` : '';
                const isSide = position === 'left' || position === 'right';
                const imgContainerClass = `relative ${sizeClass} ${isSide ? 'flex-shrink-0' : 'w-full flex justify-center'}`;

                const captionHtml = caption ? `<div class="text-gray-600 text-sm font-medium bg-gray-50 p-3 rounded-lg border border-gray-100 ${position === 'above' ? 'mb-2 w-full text-center' : position === 'below' ? 'mt-2 w-full text-center' : 'flex-1 self-center'}">${caption}</div>` : '';

                const annotationsHtml = `
                <svg class="absolute top-0 left-0 w-full h-full pointer-events-none text-red-600 overflow-visible" style="z-index: 10;">
                    <defs>
                        <marker id="arrowhead-${b.id}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
                        </marker>
                    </defs>
                    ${annotations.map((ann: any) => {
                    if (ann.type === 'arrow') {
                        return `<line x1="${ann.x}%" y1="${ann.y}%" x2="${ann.x + ann.w}%" y2="${ann.y + ann.h}%" stroke="currentColor" stroke-width="2" marker-end="url(#arrowhead-${b.id})" />`;
                    }
                    if (ann.type === 'rect') {
                        return `<rect x="${Math.min(ann.x, ann.x + ann.w)}%" y="${Math.min(ann.y, ann.y + ann.h)}%" width="${Math.abs(ann.w)}%" height="${Math.abs(ann.h)}%" fill="none" stroke="currentColor" stroke-width="2" />`;
                    }
                    return '';
                }).join('')}
                </svg>
                ${annotations.map((ann: any) => {
                    if (ann.type === 'text') {
                        return `<div style="left: ${ann.x}%; top: ${ann.y}%; z-index: 11;" class="absolute transform -translate-x-1/2 -translate-y-1/2 text-red-600 font-bold px-1 bg-white/70 rounded border border-red-200 text-sm shadow-sm pointer-events-none whitespace-nowrap">${ann.text}</div>`;
                    }
                    return '';
                }).join('')}`;

                return `<div class="${containerClass}">
                    ${position === 'above' ? captionHtml : ''}
                    <div class="${imgContainerClass}" style="${imgStyle}">
                        <div class="relative inline-block w-full">
                            <img src="${url || ''}" alt="${caption || ''}" class="rounded-lg shadow-sm border border-gray-200 object-contain w-full h-auto block" />
                            ${annotationsHtml}
                        </div>
                    </div>
                    ${(position === 'below' || isSide) ? captionHtml : ''}
                </div>`;
            }

            if (b.type === 'alert') {
                const colors = {
                    info: 'bg-blue-50 text-blue-800 border-blue-200',
                    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
                    error: 'bg-red-50 text-red-800 border-red-200',
                    success: 'bg-green-50 text-green-800 border-green-200'
                };
                const type = b.content.type || 'info';
                const colorClass = colors[type as keyof typeof colors] || colors.info;
                return `<div class="p-4 rounded-lg border ${colorClass} my-4 flex items-start gap-3">
                    <div class="font-bold uppercase text-xs mt-1">${type}</div>
                    <div>${b.content.text}</div>
                </div>`;
            }

            if (b.type === 'definedMetric') {
                const locs = b.content.locations?.map((l: any) =>
                    typeof l === 'string' ? `<span class="tag">${l}</span>` : `<span class="tag">${l.screen} - ${l.place} (${l.format})</span>`
                ).join('') || '';
                return `
                     <div class="bg-white border rounded-xl shadow-sm p-4 my-4">
                        <div class="flex items-center gap-3 border-b pb-3 mb-3 bg-gray-50 -mx-4 -mt-4 p-4 rounded-t-xl">
                            <div class="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
                            </div>
                            <span class="font-bold text-lg">${b.content.name || b.content.title || 'מדד ללא שם'}</span>
                        </div>
                        <div class="my-2 text-gray-600">${b.content.description || ''}</div>
                     </div>`;
            }

            if (b.type === 'table') {
                const rawRows = b.content.rows || [];
                const headers = b.content.headers || [];
                const caption = b.content.caption;
                const columns = b.content.columns || headers.map((h: string) => ({ name: h, type: 'text' }));
                const rows = rawRows.map((r: any) => Array.isArray(r) ? { cells: r } : r);

                const renderExportCell = (content: string, type: string) => {
                    if (!content) return '-';
                    if (type === 'id') return `<b class="font-bold">${content}</b>`;
                    if (type === 'status') {
                        return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 whitespace-nowrap">${content}</span>`;
                    }
                    if (type === 'badge') return `<span class="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">${content}</span>`;
                    if (type === 'code') return `<code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">${content}</code>`;
                    return content;
                };

                const ths = columns.map((c: any) => `<th class="px-6 py-3 border-b-2 border-gray-200 bg-gray-50 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">${c.name}</th>`).join('');
                const trs = rows.map((r: any) => `
                    <tr class="bg-white hover:bg-gray-50 transition-colors">
                        ${columns.map((c: any, j: number) => `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-b border-gray-100 text-right">${renderExportCell(r.cells[j], c.type)}</td>`).join('')}
                    </tr>
                `).join('');

                return `
                    <div class="my-6 overflow-hidden border border-gray-200 rounded-lg shadow-sm">
                        ${caption ? `<div class="bg-gray-50 px-6 py-3 border-b border-gray-200 font-medium text-gray-700 text-sm flex items-center gap-2">${caption}</div>` : ''}
                        <div class="overflow-x-auto">
                            <table class="min-w-full border-collapse w-full">
                                <thead><tr>${ths}</tr></thead>
                                <tbody class="bg-white">${trs}</tbody>
                            </table>
                        </div>
                    </div>`;
            }

            if (b.type === 'metrics') {
                const metrics = b.content.metrics || [];
                const cards = metrics.map((m: any) => `
                    <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-center">
                        <div class="text-3xl font-bold text-indigo-600 mb-1">${m.value}</div>
                        <div class="text-sm font-medium text-gray-600">${m.label}</div>
                    </div>`).join('');
                return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">${cards}</div>`;
            }

            if (b.type === 'checklist') {
                const items = b.content.items || [];
                const list = items.map((item: any) => {
                    const isDone = item.status === 'done' || item.checked === true;
                    return `
                    <div class="flex items-start gap-3 p-3 rounded-lg border border-gray-100 ${isDone ? 'bg-green-50' : 'bg-white'} mb-2 shadow-sm">
                        <div class="mt-0.5 w-5 h-5 rounded-full border-2 ${isDone ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'} flex items-center justify-center shrink-0">
                            ${isDone ? '<span class="text-xs">✓</span>' : ''}
                        </div>
                        <div class="flex-1">
                            <div class="${isDone ? 'text-gray-400 line-through' : 'text-gray-800'} font-medium text-sm text-right">${item.text}</div>
                        </div>
                    </div>`;
                }).join('');
                return `<div class="my-6 bg-white border border-gray-200 rounded-xl overflow-hidden" dir="rtl">
                    ${b.content.title ? `<div class="px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <h3 class="font-bold text-gray-900">${b.content.title}</h3>
                    </div>` : ''}
                    <div class="p-4">${list}</div>
                </div>`;
            }

            return `<div class="p-4 border border-dashed border-gray-300 rounded text-gray-400 my-2">Block type '${b.type}'</div>`;
        };

        const contentHtml = blocks.map(renderBlock).join('') || '<p>No content</p>';

        const tocHeaders = blocks
            .filter((lb: any) => lb.type === 'header')
            .map((lb: any) => ({ id: lb.id, text: lb.content.text, level: lb.content.level || 2 }));

        let tocHtml = '';
        if (tocHeaders.length > 0) {
            tocHtml = `
            <div id="toc-sidebar-${docId}" class="toc-sidebar">
                <div class="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                    <h4 style="font-weight: bold; color: #1f2937; margin: 0;">תוכן עניינים</h4>
                    <button class="lg:hidden text-gray-500" onclick="closeMobileToc()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${tocHeaders.map((header: any) => {
                let style = 'text-align: right; text-decoration: none; transition: color 0.2s; padding: 4px 0; display: block;';
                if (header.level === 1) style += ' font-weight: bold; color: #111827; margin-top: 8px;';
                else if (header.level === 2) style += ' font-weight: 600; color: #1f2937; padding-right: 8px; border-right: 2px solid #e0e7ff;';
                else if (header.level === 3) style += ' color: #4b5563; padding-right: 20px; font-size: 13px;';
                else style += ' color: #6b7280; padding-right: 32px; font-size: 12px;';

                return `<a href="#block-${header.id}" style="${style}" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color=''" onclick="closeMobileToc()">
                            ${header.text}
                        </a>`;
            }).join('')}
                </div>
            </div>`;
        }

        return NextResponse.json({ success: true, html: contentHtml, tocHtml });

    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
    }
}

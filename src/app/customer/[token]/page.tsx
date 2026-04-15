import { adminDb } from '@/lib/firebase-admin';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
    params: Promise<{ token: string }>
};

async function getSharedCustomerByToken(token: string) {
    if (!token) return null;

    try {
        const linkDoc = await adminDb.collection('wiki_shared_customer_links').doc(token).get();

        if (!linkDoc.exists) {
            return { error: 'Invalid or expired link' };
        }

        const linkData = linkDoc.data();
        if (!linkData || !linkData.active) {
            return { error: 'Link is not active' };
        }

        const customerId = linkData.customerId;

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

        let allDocs: any[] = [];
        let parentsToQuery = [`customer-${customerId}`];

        while (parentsToQuery.length > 0) {
            const currentParent = parentsToQuery.shift()!;

            const querySnapshot = await adminDb.collection('wiki_pages')
                .where('parentId', '==', currentParent)
                .get();

            for (const doc of querySnapshot.docs) {
                const data = doc.data();
                if (data.isFolder || data.isPublic === true) {
                    allDocs.push({
                        id: doc.id,
                        ...convertTimestamps(data)
                    });
                    if (data.isFolder) {
                        parentsToQuery.push(doc.id);
                    }
                }
            }
        }

        const docs = allDocs;

        let companyData = null;
        try {
            // Check if we can get company data (might fail without the API but we provide a fallback)
            const companyDoc = await adminDb.collection('companies').doc(customerId).get();
            if (companyDoc.exists) {
                companyData = convertTimestamps(companyDoc.data());
                companyData.id = companyDoc.id;
            }
        } catch (e) {
            console.error('Failed to fetch company info', e);
        }

        return {
            customer: companyData || { id: customerId, name: `Customer #${customerId}` },
            docs: docs,
            linkInfo: convertTimestamps(linkData)
        };

    } catch (error) {
        console.error('Error retrieving shared customer wiki:', error);
        return { error: 'Internal server error' };
    }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const params = await props.params;
    const { token } = params;
    const result = await getSharedCustomerByToken(token);

    if (!result || result.error || !result.customer) {
        return {
            title: 'Shared Customer Documentation Not Found',
        };
    }

    return {
        title: `${result.customer.name} - Technical Documentation`,
        robots: {
            index: false,
            follow: false,
        }
    };
}

export default async function PublicCustomerWikiPage(props: Props) {
    const params = await props.params;
    const { token } = params;
    const result = await getSharedCustomerByToken(token);

    if (!result || result.error || !result.customer) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl font-bold">!</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">מסמכים לא נמצאו</h1>
                    <p className="text-gray-500">{result?.error || 'המידע הוסר או שהקישור פג תוקף.'}</p>
                </div>
            </div>
        );
    }

    const { customer, docs, linkInfo } = result;
    const authType = linkInfo?.authType || 'none';

    if (!docs || docs.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <h1 className="text-xl font-bold text-gray-900 mb-2">אין מסמכים לחברה זו</h1>
                </div>
            </div>
        );
    }

    const isLight = (hex: string) => {
        if (!hex) return true;
        const c = hex.substring(1);
        const rgb = parseInt(c, 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = (rgb >> 0) & 0xff;
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 180;
    };

    const renderTreeRecursively = (parentId: string, docsList: any[], level = 0): string => {
        const children = docsList.filter(d => d.parentId === parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
        if (children.length === 0) return '';

        return children.map(child => {
            if (child.isFolder) {
                const childContent = renderTreeRecursively(child.id, docsList, level + 1);
                return `
                    <div style="padding-right: ${level > 0 ? '12px' : '0'}">
                        <div class="font-bold text-gray-700 my-2">${child.title}</div>
                        ${childContent}
                    </div>
                `;
            } else {
                return `<a href="#doc-${child.id}" class="block p-2 hover:bg-gray-100 rounded text-gray-700 text-sm mb-1 transition-colors nav-link" style="margin-right: ${level * 12}px" onclick="showDoc('${child.id}')">${child.title}</a>`;
            }
        }).join('');
    };

    const sidebarLinks = renderTreeRecursively(`customer-${customer.id}`, docs);

    const docContents = docs.filter((d: any) => !d.isFolder).map((d: any, index: number) => {
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
                const { url, caption, position, size, width, annotations = [], texts } = b.content;
                let sizeClass = 'max-w-md';
                switch (size) {
                    case 'small': sizeClass = 'max-w-xs'; break;
                    case 'medium': sizeClass = 'max-w-md'; break;
                    case 'large': sizeClass = 'max-w-3xl'; break;
                    case 'full': sizeClass = 'w-full'; break;
                }
                if (width) sizeClass = '';

                const currentTexts = texts !== undefined
                    ? texts
                    : (caption ? [{ id: Date.now(), text: caption, type: 'text', position: position || 'below' }] : []);

                const hasLeft = currentTexts.some((t: any) => t.position === 'left');
                const hasRight = currentTexts.some((t: any) => t.position === 'right');
                const hasSide = hasLeft || hasRight;

                const renderTextsByPos = (pos: string) => {
                    const items = currentTexts.filter((t: any) => t.position === pos);
                    if (items.length === 0) return '';
                    const isSidePos = pos === 'left' || pos === 'right';
                    const textsHtml = items.map((t: any) => {
                        const baseStyle = t.type === 'title'
                            ? 'font-size: 1.25rem; font-weight: bold; color: #111827; margin-bottom: 4px;'
                            : 'font-size: 1rem; color: #374151; line-height: 1.5;';
                        const sideStyle = !isSidePos && t.type !== 'title' ? 'background-color: #f9fafb; padding: 12px; border-radius: 8px;' : '';
                        const alignStyle = !isSidePos && t.type === 'title' ? 'text-align: center;' : '';
                        const titleSideStyle = isSidePos && t.type === 'title' ? 'color: #1e3a8a; margin-bottom: 8px;' : '';
                        return `<div style="${baseStyle} ${sideStyle} ${alignStyle} ${titleSideStyle} white-space: pre-wrap;">${t.text}</div>`;
                    }).join('');
                    const containerStyle = isSidePos
                        ? 'flex: 1; align-self: stretch; display: flex; flex-direction: column; justify-content: center; background-color: rgba(249, 250, 251, 0.5); padding: 24px; border-radius: 12px; border: 1px solid #f3f4f6; min-width: 200px; gap: 12px;'
                        : 'width: 100%; margin: 16px 0; display: flex; flex-direction: column; gap: 12px; text-align: center;';
                    return `<div style="${containerStyle}">${textsHtml}</div>`;
                };

                const imgStyle = width ? `width: ${width}px;` : '';
                const imgContainerClass = `position: relative; ${hasSide ? 'flex-shrink: 0;' : 'width: 100%; display: flex; justify-content: center;'} ${width ? '' : (size === 'full' ? 'width: 100%;' : size === 'large' ? 'max-width: 48rem;' : size === 'small' ? 'max-width: 20rem;' : 'max-width: 28rem;')}`;
                const flexRowDirection = `display: flex; width: 100%; align-items: flex-start; gap: 32px; flex-direction: row; flex-wrap: wrap; justify-content: ${hasSide ? 'space-between' : 'center'};`;

                const annotationsHtml = `
                <svg id="svg-layer-${b.id}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; color: #dc2626; overflow: visible; z-index: 10;">
                    <defs>
                        <marker id="arrowhead-${b.id}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
                        </marker>
                    </defs>
                    ${annotations.map((ann: any) => {
                    if (ann.type === 'arrow') {
                        return `<line x1="${ann.x}%" y1="${ann.y}%" x2="${ann.x + ann.w}%" y2="${ann.y + ann.h}%" stroke="${ann.color || 'currentColor'}" stroke-width="2" marker-end="url(#arrowhead-${b.id})" />`;
                    }
                    if (ann.type === 'rect') {
                        return `<rect x="${Math.min(ann.x, ann.x + ann.w)}%" y="${Math.min(ann.y, ann.y + ann.h)}%" width="${Math.abs(ann.w)}%" height="${Math.abs(ann.h)}%" fill="none" stroke="${ann.color || 'currentColor'}" stroke-width="2" />`;
                    }
                    if (ann.type === 'filledRect') {
                        return `<rect x="${Math.min(ann.x, ann.x + ann.w)}%" y="${Math.min(ann.y, ann.y + ann.h)}%" width="${Math.abs(ann.w)}%" height="${Math.abs(ann.h)}%" fill="${ann.color || '#0B3F55'}" stroke="none" rx="4" ry="4" />`;
                    }
                    return '';
                }).join('')}
                </svg>
                ${annotations.map((ann: any) => {
                    if (ann.type === 'text') {
                        return `<div class="text-layer-${b.id}" style="left: ${ann.x}%; top: ${ann.y}%; z-index: 11; position: absolute; color: #dc2626; font-weight: bold; padding: 0 4px; background-color: rgba(255, 255, 255, 0.7); border-radius: 4px; border: 1px solid #fecaca; font-size: 0.875rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); pointer-events: none; white-space: nowrap;">${ann.text}</div>`;
                    }
                    return '';
                }).join('')}`;

                return `<div style="margin: 32px 0; display: flex; flex-direction: column; align-items: center; width: 100%;" dir="rtl">
                    ${renderTextsByPos('above')}
                    <div style="${flexRowDirection}">
                        ${renderTextsByPos('right')}
                        <div style="${imgContainerClass} ${imgStyle}">
                            ${url ? `
                            <div style="position: relative; display: inline-block; width: 100%;">
                                <img id="wiki-img-${b.id}" src="${url}" alt="Wiki Image" style="border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; object-fit: contain; width: 100%; height: auto; display: block;" />
                                ${annotationsHtml}
                                ${annotations && annotations.length > 0 ? `
                                <script>
                                window.addEventListener('load', function() {
                                    var img = document.getElementById('wiki-img-${b.id}');
                                    if (!img) return;
                                    var anns = JSON.parse(decodeURIComponent("${encodeURIComponent(JSON.stringify(annotations))}"));
                                    var draw = function() {
                                        var cvs = document.createElement('canvas');
                                        var w = img.naturalWidth || img.width || 800;
                                        var h = img.naturalHeight || img.height || 600;
                                        var minX = 0, minY = 0, maxX = w, maxY = h;
                                        var tCtx = cvs.getContext('2d');
                                        tCtx.font = "bold 16px sans-serif";
                                        anns.forEach(function(a) {
                                            var x = (a.x/100)*w, y = (a.y/100)*h, aw = (a.w/100)*w, ah = (a.h/100)*h;
                                            if (a.type === 'text') {
                                                var tm = tCtx.measureText(a.text).width;
                                                minX = Math.min(minX, x - 8); maxX = Math.max(maxX, x + tm + 8);
                                                minY = Math.min(minY, y - 20); maxY = Math.max(maxY, y + 8);
                                            } else {
                                                var rx=Math.min(x, x+aw), ry=Math.min(y, y+ah), rw=Math.abs(aw), rh=Math.abs(ah);
                                                var p = 16;
                                                minX = Math.min(minX, rx - p); maxX = Math.max(maxX, rx + rw + p);
                                                minY = Math.min(minY, ry - p); maxY = Math.max(maxY, ry + rh + p);
                                            }
                                        });
                                        var newW = maxX - minX;
                                        var newH = maxY - minY;
                                        cvs.width = newW; cvs.height = newH;
                                        var ctx = cvs.getContext('2d');
                                        ctx.fillStyle = '#ffffff';
                                        ctx.fillRect(0, 0, newW, newH);
                                        ctx.drawImage(img, -minX, -minY, w, h);
                                        anns.forEach(function(a) {
                                            var x = (a.x/100)*w - minX, y = (a.y/100)*h - minY, aw = (a.w/100)*w, ah = (a.h/100)*h;
                                            if (a.type === 'filledRect') {
                                                var rx=Math.min(x, x+aw), ry=Math.min(y, y+ah), rw=Math.abs(aw), rh=Math.abs(ah);
                                                ctx.fillStyle = a.color || '#0B3F55';
                                                var r = 4; ctx.beginPath();
                                                ctx.moveTo(rx+r, ry); ctx.lineTo(rx+rw-r, ry); ctx.quadraticCurveTo(rx+rw, ry, rx+rw, ry+r);
                                                ctx.lineTo(rx+rw, ry+rh-r); ctx.quadraticCurveTo(rx+rw, ry+rh, rx+rw-r, ry+rh);
                                                ctx.lineTo(rx+r, ry+rh); ctx.quadraticCurveTo(rx, ry+rh, rx, ry+rh-r);
                                                ctx.lineTo(rx, ry+r); ctx.quadraticCurveTo(rx, ry, rx+r, ry);
                                                ctx.fill();
                                            } else if (a.type === 'rect') {
                                                var rx=Math.min(x, x+aw), ry=Math.min(y, y+ah), rw=Math.abs(aw), rh=Math.abs(ah);
                                                ctx.strokeStyle = a.color || '#dc2626'; ctx.lineWidth = 3;
                                                ctx.strokeRect(rx, ry, rw, rh);
                                            } else if (a.type === 'arrow') {
                                                var ex = x+aw, ey = y+ah;
                                                ctx.strokeStyle = a.color || '#dc2626'; ctx.fillStyle = a.color || '#dc2626'; ctx.lineWidth = 3;
                                                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
                                                var ang = Math.atan2(ey-y, ex-x);
                                                ctx.beginPath(); ctx.moveTo(ex, ey);
                                                ctx.lineTo(ex-12*Math.cos(ang-Math.PI/6), ey-12*Math.sin(ang-Math.PI/6));
                                                ctx.lineTo(ex-12*Math.cos(ang+Math.PI/6), ey-12*Math.sin(ang+Math.PI/6));
                                                ctx.fill();
                                            } else if (a.type === 'text') {
                                                ctx.font = "bold 16px sans-serif";
                                                var tm = ctx.measureText(a.text).width, th = 16, px = 6, py = 4;
                                                ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.strokeStyle = '#fecaca'; ctx.lineWidth = 1.5;
                                                ctx.fillRect(x-px, y-th, tm+px*2, th+py*2); ctx.strokeRect(x-px, y-th, tm+px*2, th+py*2);
                                                ctx.fillStyle = '#dc2626'; ctx.textBaseline = 'bottom';
                                                ctx.fillText(a.text, x, y+py);
                                            }
                                        });
                                        try {
                                            img.src = cvs.toDataURL('image/jpeg', 0.95);
                                            var svgL = document.getElementById('svg-layer-${b.id}');
                                            if (svgL) svgL.style.display = 'none';
                                            Array.from(document.querySelectorAll('.text-layer-${b.id}')).forEach(function(e){ e.style.display='none'; });
                                        } catch(e) {}
                                    };
                                    if (img.complete) draw(); else img.onload = draw;
                                });
                                </script>
                                ` : ''}
                            </div>
                            ` : `<div style="background-color: #f3f4f6; height: 12rem; width: 100%; display: flex; align-items: center; justify-content: center; color: #9ca3af; border-radius: 12px; border: 1px solid #e5e7eb;">אין תמונה להצגה</div>`}
                        </div>
                        ${renderTextsByPos('left')}
                    </div>
                    ${renderTextsByPos('below')}
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
                const { name, title, description, formula, requiredConfigs, locations, approvedBy, approvedAt } = b.content;

                return `
                <div id="block-${b.id}" class="border border-gray-200 rounded-xl overflow-hidden shadow-sm my-6 dir-rtl font-sans">
                    <div class="bg-gradient-to-l from-indigo-50 to-white p-4 sm:p-6 border-b border-gray-100 flex items-center gap-3">
                        <div class="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
                        </div>
                        <div>
                            <h3 class="m-0 text-xl font-bold text-gray-900 leading-tight">${name || title || 'מדד ללא שם'}</h3>
                            ${description ? `<p class="mt-1 text-sm text-gray-500 leading-relaxed whitespace-pre-wrap">${description}</p>` : ''}
                        </div>
                    </div>

                    ${(approvedBy || approvedAt) ? `
                    <div class="bg-green-50 px-6 py-2 border-b border-green-100 flex items-center gap-2 text-xs text-green-800">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>אושר ע"י <strong>${approvedBy || 'לא צוין'}</strong>${approvedAt ? ` ב- ${new Date(approvedAt).toLocaleDateString('he-IL')}` : ''}</span>
                    </div>
                    ` : ''}

                    <div class="p-6 flex flex-col gap-5">
                        <div>
                            <div class="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1.5">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                                נוסחה
                            </div>
                            <div class="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-sm block overflow-x-auto text-left" dir="ltr">
                                ${formula || '// לא הוגדרה נוסחה'}
                            </div>
                        </div>

                        ${requiredConfigs ? `
                        <div>
                            <div class="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1.5">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                                הגדרות נדרשות
                            </div>
                            <div class="bg-gray-50 border border-gray-200 p-3 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                                ${requiredConfigs}
                            </div>
                        </div>
                        ` : ''}

                        ${Array.isArray(locations) && locations.length > 0 ? `
                        <div>
                            <div class="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1.5">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
                                מוגדר ב:
                            </div>
                            <div class="border border-gray-200 rounded-lg overflow-hidden">
                                <table class="w-full text-right text-sm">
                                    <thead class="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                                        <tr>
                                            <th class="px-3 py-2 font-semibold">מסך</th>
                                            <th class="px-3 py-2 font-semibold">מיקום</th>
                                            <th class="px-3 py-2 font-semibold">פורמט</th>
                                        </tr>
                                    </thead>
                                    <tbody class="bg-white divide-y divide-gray-100">
                                        ${locations.map((loc: any) => `
                                        <tr>
                                            <td class="px-3 py-2.5 text-gray-900 font-medium">${typeof loc === 'string' ? loc : (loc.screen || '-')}</td>
                                            <td class="px-3 py-2.5 text-gray-600">${typeof loc === 'string' ? '' : (loc.place || '-')}</td>
                                            <td class="px-3 py-2.5">
                                                ${(typeof loc !== 'string' && loc.format) ? `<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">${loc.format}</span>` : '-'}
                                            </td>
                                        </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        ` : ''}
                    </div>
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

            if (b.type === 'gantt') {
                const { startDate, phases = [] } = b.content;
                let maxWeek = 4;
                phases.forEach((p: any) => {
                    const ew = p.isMilestone ? (parseInt(p.startWeek) || 1) : (parseInt(p.startWeek) || 1) + (parseInt(p.durationWeeks) || 1) - 1;
                    if (ew > maxWeek) maxWeek = ew;
                });

                const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1);

                const getPhaseStartDate = (startWk: number) => {
                    if (!startDate) return '';
                    const phaseStart = new Date(new Date(startDate).getTime() + (startWk - 1) * 7 * 24 * 60 * 60 * 1000);
                    return phaseStart.toLocaleDateString('he-IL');
                };

                let currentWeekFloat = -1;
                if (startDate) {
                    const start = new Date(startDate);
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    const diffTime = now.getTime() - start.getTime();
                    const diffWeeks = diffTime / (1000 * 60 * 60 * 24 * 7);
                    currentWeekFloat = diffWeeks >= 0 ? diffWeeks + 1 : -1;
                }
                const showCurrentLine = currentWeekFloat > 0 && currentWeekFloat <= maxWeek + 1;
                const currentLineRightPerc = showCurrentLine ? ((currentWeekFloat - 1) / maxWeek) * 100 : 0;

                const gridLines = weeks.map(w => `<div class="flex-1 border-r border-slate-100 last:border-l relative"></div>`).join('');

                const currentLineHtml = showCurrentLine ? `<div class="absolute top-0 bottom-0 bg-opacity-60 bg-green-500 z-10 w-px shadow-[0_0_8px_rgba(34,197,94,0.6)]" style="right: min(calc(30% + ${currentLineRightPerc * 0.7}%), 100%);"></div>` : '';

                const phaseRows = phases.map((p: any, index: number) => {
                    const sW = parseInt(p.startWeek) || 1;
                    const dW = parseInt(p.durationWeeks) || 1;
                    const widthPerc = (dW / maxWeek) * 100;
                    const rightPerc = ((sW - 1) / maxWeek) * 100;
                    const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-teal-500', 'bg-sky-500'];
                    const barColor = colors[index % colors.length];
                    const pStart = getPhaseStartDate(sW);

                    if (p.isMilestone) {
                        const mRight = ((sW - 1) / maxWeek) * 100 + ((1 / maxWeek) * 50);
                        return `
                            <div class="relative block z-10 mb-6">
                                <div class="flex items-center mb-2">
                                    <div class="w-[30%] shrink-0 pl-4 border-l border-slate-200">
                                        <div class="font-bold text-green-700 text-sm leading-tight mb-0.5 flex items-center gap-1.5 ${p.isCompleted ? 'line-through opacity-70' : ''}">
                                            <div class="w-2 h-2 bg-green-500 transform rotate-45"></div>
                                            ${p.name || 'אבן דרך'}
                                            ${p.isCompleted ? `<svg class="w-3.5 h-3.5 text-green-600 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10-0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>` : ''}
                                        </div>
                                        ${pStart ? `<div class="text-[10px] text-slate-500 font-medium ml-3.5">בסביבות: ${pStart}</div>` : ''}
                                        ${p.note ? `<div class="text-[10px] text-gray-500 mt-0.5 ml-3.5 leading-tight">${p.note}</div>` : ''}
                                    </div>
                                    <div class="w-[70%] relative h-10 flex items-center pr-1 pl-1">
                                        <div class="absolute transform translate-x-1/2 flex flex-col items-center group z-10 hover:z-20" style="right: ${mRight}%;">
                                            <div class="w-3 h-3 bg-green-500 transform rotate-45 shadow-sm border border-white z-10"></div>
                                            ${p.paymentInfo ? `<div class="absolute top-5 bg-green-50 border border-green-200 shadow-md rounded-md px-2 py-1 text-[11px] font-bold text-green-800 whitespace-nowrap opacity-95">${p.paymentInfo}</div>` : ''}
                                        </div>
                                        <div class="absolute left-0 right-0 h-px bg-slate-100 top-1/2 pointer-events-none"></div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }

                    return `
                        <div class="relative block z-10 mb-6">
                            <div class="flex items-center mb-2">
                                <div class="w-[30%] shrink-0 pl-4 border-l border-slate-200">
                                    <div class="font-bold text-slate-800 text-sm leading-tight mb-0.5 flex items-center ${p.isCompleted ? 'line-through opacity-70' : ''}">
                                        ${p.name || 'ללא שם'}
                                        ${p.isCompleted ? `<svg class="w-3.5 h-3.5 text-green-600 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10-0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>` : ''}
                                    </div>
                                    <div class="text-xs text-slate-400 mb-0.5">${dW} שבועות</div>
                                    ${pStart ? `<div class="text-[10px] text-slate-500 font-medium">מתחיל: ${pStart}</div>` : ''}
                                    ${p.note ? `<div class="text-[10px] text-gray-500 mt-0.5 leading-tight">${p.note}</div>` : ''}
                                </div>
                                <div class="w-[70%] relative h-8 flex items-center bg-slate-50 border border-slate-100 rounded-lg px-1">
                                    <div class="absolute top-1.5 bottom-1.5 rounded-md shadow-sm flex items-center pr-2 ${barColor} transition-all opacity-90" style="right: ${rightPerc}%; width: ${widthPerc}%;">
                                        ${pStart ? `<span class="text-white text-[10px] font-medium opacity-90 truncate block max-w-full">${pStart}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            ${p.tasks && p.tasks.length > 0 ? `
                            <div class="pr-4 pl-12 pb-2 mr-[30%] relative">
                                <div class="absolute right-0 top-0 bottom-4 w-px bg-slate-200"></div>
                                <div class="absolute right-0 top-3 w-4 h-px bg-slate-200"></div>
                                <div class="bg-white border border-slate-200 rounded-lg p-3 inline-block min-w-[60%] shadow-sm">
                                    <ul class="space-y-1.5 m-0 p-0 overflow-hidden">
                                        ${p.tasks.map((t: any) => `
                                            <li class="text-[13px] text-slate-700 flex items-center gap-2 ${t.isCompleted ? 'opacity-70 line-through' : ''}">
                                                ${t.isCompleted ? `<svg class="w-3 h-3 text-green-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10-0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>` : `<div class="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></div>`}
                                                <span class="flex-1">${t.title}</span>
                                                ${t.ticketId ? `<span class="bg-slate-50 border border-slate-200 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-mono shadow-sm" dir="ltr">${t.ticketId}</span>` : ''}
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>
                            </div>` : ''}
                        </div>
                    `;
                }).join('');

                // The milestoneHtml section is being removed as per the instruction to integrate milestone rendering directly into phaseRows.
                // The existing phaseRows already handles milestones (p.isMilestone) within its loop.
                // const milestoneHtml = (milestones && milestones.length > 0) ? `
                //     <div class="flex mt-8 border-t border-slate-200 pt-6 relative z-10">
                //         <div class="w-[30%] shrink-0 pl-4 flex flex-col justify-center">
                //             <div class="font-bold text-green-700 text-sm flex items-center gap-2">
                //                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                //                 אבני דרך (Milestones)
                //             </div>
                //         </div>
                //         <div class="w-[70%] relative min-h-[80px]">
                //             ${milestones.map((m: any, idx: number) => {
                //     const mWeek = parseInt(m.week) || 1;
                //     const mRight = ((mWeek - 1) / maxWeek) * 100 + ((1 / maxWeek) * 50);
                //     const lane = idx % 3;
                //     const topOffset = lane * 40;
                //     return `
                //                     <div class="absolute transform translate-x-1/2 flex flex-col items-center group z-10" style="top: ${topOffset}px; right: ${mRight}%;">
                //                         <div class="w-0.5 bg-green-200 mb-0.5" style="height: ${20 + lane * 40}px; margin-top: -${20 + lane * 40}px;"></div>
                //                         <div class="w-2.5 h-2.5 bg-green-500 transform rotate-45 -mt-2.5 mb-2 shadow-sm border border-white"></div>
                //                         <div class="bg-white border text-center border-green-200 shadow-md rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-800 whitespace-nowrap">
                //                             ${m.name}
                //                             ${m.paymentInfo ? `<div class="text-green-600 mt-0.5 text-[10px] bg-green-50 px-1 py-0.5 rounded-sm">${m.paymentInfo}</div>` : ''}
                //                         </div>
                //                     </div>
                //                 `;
                // }).join('')}
                //         </div>
                //     </div>
                // ` : '';

                return `
                    <div class="my-8 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm" dir="rtl">
                        <div class="bg-slate-50 border-b border-gray-200 p-4 flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="text-indigo-600" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                <h3 class="font-bold text-gray-800 text-lg m-0">תכנון פרויקט ותכולות</h3>
                            </div>
                            ${startDate ? `<div class="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">תאריך התחלה: ${new Date(startDate).toLocaleDateString('he-IL')}</div>` : ''}
                        </div>
                        
                        <div class="p-6 overflow-x-auto">
                            <div class="min-w-[800px]">
                                <div class="flex border-b-2 border-slate-200 pb-2 mb-6">
                                    <div class="w-[30%] shrink-0 font-bold text-slate-700 text-sm">שלב המערכת / משימות</div>
                                    <div class="w-[70%] flex relative">
                                        ${weeks.map(w => `
                                            <div class="flex-1 text-center font-bold text-xs text-slate-400 shrink-0 border-r border-slate-100 last:border-l relative">
                                                ${w === 1 ? 'שבוע 1' : w}
                                                ${showCurrentLine && Math.floor(currentWeekFloat) === w ? `<div class="absolute top-0 right-1/2 translate-x-1/2 -mt-4 text-[10px] bg-green-100 text-green-800 px-1 rounded font-bold shadow-sm border border-green-200 z-20">היום</div>` : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>

                                <div class="relative">
                                    ${phases.length > 0 ? `<div class="absolute inset-0 flex justify-end items-stretch pointer-events-none" style="left: 0; right: 30%;">${gridLines}</div>` : ''}
                                    ${currentLineHtml}
                                    ${phaseRows}
                                </div>

                                <!-- ${'milestoneHtml'} was removed as per instruction -->
                            </div>
                        </div>
                    </div>
                `;
            }

            return `<div class="p-4 border border-dashed border-gray-300 rounded text-gray-400 my-2">Block type '${b.type}'</div>`;
        };

        const isProtected = d.requiresPassword && authType !== 'none';

        let contentHtml = '';
        let tocHtml = '';

        if (isProtected) {
            contentHtml = `
                <div id="auth-container-${d.id}" class="max-w-md mx-auto my-12 bg-white p-6 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100">
                    <div class="text-center mb-6">
                        <div class="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </div>
                        <h3 class="text-xl font-bold text-gray-800">מסמך מוגן</h3>
                        <p class="text-sm text-gray-500 mt-2">יש להזין פרטי זיהוי כדי לצפות בתוכן מסמך זה.</p>
                    </div>
                    
                    <div class="space-y-4">
                        ${authType === 'contacts' ? `
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">דוא"ל</label>
                            <input type="email" id="username-${d.id}" class="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ltr-text" dir="ltr" placeholder="mail@example.com" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">טלפון (משמש כסיסמה)</label>
                            <input type="password" id="password-${d.id}" class="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ltr-text" dir="ltr" placeholder="05x-xxxxxxx" />
                        </div>
                        ` : `
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
                            <input type="password" id="password-${d.id}" class="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ltr-text" dir="ltr" placeholder="••••••••" />
                        </div>
                        `}
                        <div id="error-${d.id}" class="text-sm font-medium text-red-500 hidden text-center bg-red-50 p-2 rounded-lg border border-red-100"></div>
                        <button onclick="authenticateDoc('${d.id}', '${token}', '${authType}')" id="btn-${d.id}" class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm transition-colors mt-2 flex justify-center items-center gap-2">
                            <span>היכנס למסמך</span>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="-mr-1"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                        </button>
                    </div>
                </div>
                <div id="protected-content-${d.id}" class="hidden"></div>
            `;
        } else {
            contentHtml = d.blocks?.map(renderBlock).join('') || '<p>No content</p>';

            const tocHeaders = (d.blocks || [])
                .filter((lb: any) => lb.type === 'header')
                .map((lb: any) => ({ id: lb.id, text: lb.content.text, level: lb.content.level || 2 }));

            if (tocHeaders.length > 0) {
                tocHtml = `
                <div id="toc-sidebar-${d.id}" class="toc-sidebar">
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
        }



        return `
            <div id="doc-${d.id}" class="doc-content ${index === 0 ? '' : 'hidden'} animate-fade-in">
                <div class="page-container">
                    <div class="doc-card content-area">
                        <div class="flex justify-between items-end border-b border-gray-200 pb-4 mb-6">
                            <h1 class="text-3xl font-bold text-[#1D4A5C]">${d.title}</h1>
                            <div class="text-xs text-gray-500 text-left flex flex-col gap-1">
                                ${d.metadata?.updatedAt ? `<div><strong>עודכן:</strong> ${new Date(d.metadata.updatedAt).toLocaleDateString('he-IL')} ${new Date(d.metadata.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div>` : ''}
                                ${d.metadata?.updatedBy ? `<div><strong>ע"י:</strong> ${d.metadata.updatedBy.split('@')[0]}</div>` : ''}
                            </div>
                        </div>
                        ${contentHtml}
                    </div>
                    ${isProtected ? `<div id="protected-toc-${d.id}" class="hidden"></div>` : tocHtml}
                </div>
            </div>`;
    }).join('');

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { margin: 0; padding: 0; }
        .sidebar { width: 280px; background: white; height: 100vh; position: fixed; right: 0; top: 0; border-left: 1px solid #e5e7eb; padding: 20px; overflow-y: auto; z-index: 40; transition: transform 0.3s ease; }
        .main-content { margin-right: 280px; padding: 40px; max-width: 1500px; }
        .doc-card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); min-height: 80vh; }
        .nav-link.active { background-color: #eff6ff; color: #1d4ed8; font-weight: 500; border-right: 3px solid #1d4ed8; }
        .tag { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background-color: #eef2ff; color: #4338ca; border: 1px solid #e0e7ff; margin-right: 4px; }
        .hidden { display: none; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 10px; }

        /* TOC and Layout */
        .page-container { display: flex; gap: 32px; align-items: flex-start; }
        .content-area { flex: 1; min-width: 0; }
        
        .toc-sidebar {
            position: sticky; top: 40px; width: 250px; flex-shrink: 0;
            background: rgba(255,255,255,0.95); border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-height: calc(100vh - 80px); overflow-y: auto;
            z-index: 30; transition: transform 0.3s ease;
        }

        /* Mobile Adjustments */
        .mobile-nav { display: none; position: fixed; top: 0; left: 0; right: 0; height: 60px; background: white; border-bottom: 1px solid #e5e7eb; z-index: 35; align-items: center; justify-content: space-between; padding: 0 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 34; opacity: 0; transition: opacity 0.3s ease; }
        .overlay.open { display: block; opacity: 1; }

        .toc-toggle-btn {
            display: none; position: fixed; bottom: 24px; left: 24px; background: #1D4A5C; color: white; border: none; border-radius: 50%; width: 56px; height: 56px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 50; align-items: center; justify-content: center; cursor: pointer;
        }

        @media (max-width: 1024px) {
            .mobile-nav { display: flex; }
            .sidebar { transform: translateX(100%); }
            .sidebar.open { transform: translateX(0); }
            
            .main-content { margin-right: 0; padding: 16px; padding-top: 76px; max-width: 100%; width: 100vw; box-sizing: border-box; }
            .doc-card { padding: 20px; }
            .page-container { display: block; }
            
            .toc-sidebar {
                position: fixed; top: 0; left: 0; bottom: 0; height: 100vh; max-height: 100vh;
                border-radius: 0; transform: translateX(-100%); width: 280px;
            }
            .toc-sidebar.open { transform: translateX(0); }
            .toc-toggle-btn { display: flex; }
        }

        @media print {
            .toc-sidebar { display: none !important; }
            .sidebar { display: none !important; }
            .main-content { margin-right: 0 !important; max-width: 100% !important; padding: 0 !important; }
            .doc-card { box-shadow: none !important; border: none !important; padding: 0 !important; }
            .mobile-nav { display: none !important; }
            .toc-toggle-btn { display: none !important; }
        }
    </style>
    <script>
        function showDoc(id) {
            document.querySelectorAll('.doc-content').forEach(el => el.classList.add('hidden'));
            const target = document.getElementById('doc-' + id);
            if(target) target.classList.remove('hidden');
            document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active', 'bg-blue-50', 'text-blue-600'));
            const link = document.querySelector(\`a[href="#doc-\${id}"]\`);
            if(link) link.classList.add('active', 'bg-blue-50', 'text-blue-600');
            window.scrollTo(0,0);
            closeMainSidebar(); // Close sidebar on mobile after clicking
        }
        
        function toggleMainSidebar() {
            document.getElementById('main-sidebar').classList.toggle('open');
            document.getElementById('main-overlay').classList.toggle('open');
        }
        function closeMainSidebar() {
            document.getElementById('main-sidebar').classList.remove('open');
            document.getElementById('main-overlay').classList.remove('open');
        }

        function toggleMobileToc() {
            document.querySelectorAll('.toc-sidebar').forEach(el => el.classList.toggle('open'));
            document.getElementById('toc-overlay').classList.toggle('open');
        }
        function closeMobileToc() {
            document.querySelectorAll('.toc-sidebar').forEach(el => el.classList.remove('open'));
            document.getElementById('toc-overlay').classList.remove('open');
        }

        async function authenticateDoc(docId, token, authType) {
            const btn = document.getElementById('btn-' + docId);
            const errEl = document.getElementById('error-' + docId);
            btn.innerHTML = '<div style="width:16px;height:16px;border:2px solid transparent;border-top-color:white;border-radius:50%;animation:spin 1s linear infinite;"></div> טוען...';
            btn.disabled = true;
            errEl.classList.add('hidden');
            
            let username = '';
            let password = '';
            
            if (authType === 'contacts') {
                username = document.getElementById('username-' + docId).value;
                password = document.getElementById('password-' + docId).value;
            } else {
                password = document.getElementById('password-' + docId).value;
            }
            
            try {
                const response = await fetch('/api/verify-doc', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, docId, username, password })
                });
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('auth-container-' + docId).classList.add('hidden');
                    
                    const contentEl = document.getElementById('protected-content-' + docId);
                    contentEl.innerHTML = data.html;
                    contentEl.classList.remove('hidden');
                    
                    if (data.tocHtml) {
                        const tocEl = document.getElementById('protected-toc-' + docId);
                        tocEl.outerHTML = data.tocHtml; // Replace the placeholder with the actual TOC
                    }
                } else {
                    errEl.innerText = data.error || 'שגיאה באימות';
                    errEl.classList.remove('hidden');
                    btn.innerHTML = 'הכנס';
                    btn.disabled = false;
                }
            } catch (error) {
                errEl.innerText = 'שגיאת רשת';
                errEl.classList.remove('hidden');
                btn.innerHTML = 'הכנס';
                btn.disabled = false;
            }
        }
    </script>
    <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
</head>
<body class="bg-gray-50 text-gray-900">
    <!-- Mobile Nav Header -->
    <div class="mobile-nav">
        <button onclick="toggleMainSidebar()" class="text-gray-600 p-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <img src="/logo.png" alt="Logo" style="height: 32px; object-fit: contain;" />
        <div style="width: 40px"></div>
    </div>

    <!-- Overlays -->
    <div id="main-overlay" class="overlay" onclick="closeMainSidebar()"></div>
    <div id="toc-overlay" class="overlay" onclick="closeMobileToc()" style="z-index: 29;"></div>

    <!-- TOC Mobile Float Button -->
    <button class="toc-toggle-btn" onclick="toggleMobileToc()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h10M7 16h10"/></svg>
    </button>

    <div id="main-sidebar" class="sidebar shadow-md z-10">
        <div class="mb-8 flex justify-between items-start border-b pb-6">
             <div class="flex flex-col items-center flex-1">
                 <img src="/logo.png" alt="MIR Logo" style="height: 48px; object-fit: contain; margin-bottom: 8px;" />
                 <div class="text-xs text-gray-500 font-medium tracking-wider uppercase mt-1">תיעוד טכני ללקוח</div>
                 <div class="text-xs text-gray-400 font-medium mt-1">${customer.name || ''}</div>
             </div>
             <button class="lg:hidden text-gray-500 p-1" onclick="closeMainSidebar()">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
             </button>
        </div>
        <nav class="space-y-1">
            ${sidebarLinks}
        </nav>
    </div>
    <div class="main-content">
        ${docContents}
    </div>
</body>
</html>`;

    return (
        <div
            dangerouslySetInnerHTML={{ __html: html }}
            className="min-h-screen bg-gray-50"
        />
    );
}

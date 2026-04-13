export const generateHTML = (data: any, logoBase64: string | null) => {
    const renderBlock = (b: any): string => {
        if (!b) return '';
        if (b.type === 'header') {
            const level = b.content.level || 2;
            const sizeMap: any = { 1: '1.875rem', 2: '1.5rem', 3: '1.25rem', 4: '1.125rem' };
            const styles = `font-weight: bold; color: #111827; margin-bottom: 1rem; font-size: ${sizeMap[level] || '1rem'}; ${level === 2 ? 'border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem;' : ''}`;
            return `<h${level} style="${styles}">${b.content.text}</h${level}>`;
        }

        if (b.type === 'text') {
            return `<div style="color: #374151; white-space: pre-wrap; margin-bottom: 1rem; line-height: 1.6;">${b.content.text}</div>`;
        }

        if (b.type === 'colorPalette') {
            const colors = b.content.colors || [];
            if (!colors.length) return '';
            const items = colors.map((c: any) => `
                <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column;">
                    <div style="background-color: ${c.hex}; height: 80px; width: 100%;"></div>
                    <div style="padding: 12px; background: white;">
                        <div style="font-weight: bold; font-size: 0.875rem; color: #1f2937;">${c.name}</div>
                        <div style="font-size: 0.75rem; color: #6b7280; font-family: monospace;">${c.hex}</div>
                    </div>
                </div>
            `).join('');
            return `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem; margin: 1.5rem 0;">${items}</div>`;
        }

        if (b.type === 'code') {
            return `<pre style="background-color: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-family: monospace; font-size: 0.875rem; direction: ltr; margin: 1.5rem 0;"><code>${b.content.code}</code></pre>`;
        }

        if (b.type === 'table') {
            const { caption, headers = [], rows: rawRows = [] } = b.content;
            if (!headers.length) return '';
            const tableId = `tbl_${Math.random().toString(36).substring(2, 9)}`;
            const columns = b.content.columns || headers.map((h: string) => ({ name: h, type: 'text' }));
            const rows = rawRows.map((r: any) => Array.isArray(r) ? { cells: r } : r);

            const renderExportCell = (content: string, type: string) => {
                if (!content) return '-';
                if (type === 'id') return `<b style="font-weight: bold;">${content}</b>`;
                if (type === 'status') {
                    const isPositive = ['connected', 'active', 'online', 'yes', 'true', 'ok'].some(k => content.toLowerCase().includes(k));
                    const isNegative = ['not', 'disconnected', 'offline', 'no', 'false', 'error'].some(k => content.toLowerCase().includes(k));

                    // Check for custom status colors
                    const customColors = columns.find((c: any) => c.type === 'status')?.statusColors;
                    let customColor = null;
                    if (customColors && customColors[content]) {
                        customColor = customColors[content];
                    }

                    let bg = '#f3f4f6'; let color = '#1f2937';
                    if (customColor) {
                        if (customColor === 'green') { bg = '#dcfce7'; color = '#166534'; }
                        else if (customColor === 'red') { bg = '#fee2e2'; color = '#991b1b'; }
                        else if (customColor === 'blue') { bg = '#dbeafe'; color = '#1e40af'; }
                        else if (customColor === 'yellow') { bg = '#fef9c3'; color = '#854d0e'; }
                        else if (customColor === 'orange') { bg = '#ffedd5'; color = '#9a3412'; }
                        else if (customColor === 'purple') { bg = '#f3e8ff'; color = '#6b21a8'; }
                        else if (customColor === 'gray') { bg = '#f3f4f6'; color = '#1f2937'; }
                    } else {
                        if (isPositive) { bg = '#dcfce7'; color = '#166534'; }
                        else if (isNegative) { bg = '#fee2e2'; color = '#991b1b'; }
                    }

                    return `<span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background-color: ${bg}; color: ${color}; white-space: nowrap;">${content}</span>`;
                }
                if (type === 'badge') return `<span style="background-color: #dbeafe; color: #1e40af; font-size: 0.75rem; font-weight: 500; padding: 2px 8px; border-radius: 4px; display: inline-block;">${content}</span>`;
                if (type === 'code') return `<code style="background-color: #f3f4f6; padding: 2px 4px; border-radius: 4px; font-size: 0.75rem; font-family: monospace;">${content}</code>`;
                return content;
            };

            const ths = columns.map((c: any) => `<th style="padding: 12px 24px; border-bottom: 2px solid #e5e7eb; background-color: #f9fafb; text-align: right; font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase;">${c.name}</th>`).join('');
            const trs = rows.map((r: any) => `
                <tr style="background-color: #ffffff;">
                    ${columns.map((c: any, j: number) => `<td style="padding: 16px 24px; white-space: nowrap; font-size: 0.875rem; color: #6b7280; border-bottom: 1px solid #f3f4f6; text-align: right;">${renderExportCell(r.cells[j], c.type)}</td>`).join('')} 
                </tr>
            `).join('');

            return `
                <div style="margin: 24px 0; overflow: hidden; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                    <div style="background-color: #f9fafb; padding: 12px 24px; border-bottom: 1px solid #e5e7eb; justify-content: space-between; font-weight: 500; color: #374151; font-size: 0.875rem; display: flex; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #9ca3af;"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="3" x2="21" y1="15" y2="15"/><line x1="9" x2="9" y1="9" y2="21"/><line x1="15" x2="15" y1="9" y2="21"/></svg>
                            ${caption || 'טבלה'}
                        </div>
                        <button class="no-print" onclick="downloadTableCSV('${tableId}', '${(caption || 'table').replace(/'/g, "\\'")}')" style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; color: #374151; font-size: 12px; font-family: inherit; font-weight: 500; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/></svg>
                            הורד לאקסל
                        </button>
                    </div>
                    <div style="overflow-x: auto;">
                        <table id="${tableId}" style="min-width: 100%; border-collapse: collapse; width: 100%;">
                            <thead><tr>${ths}</tr></thead>
                            <tbody style="background-color: #ffffff;">${trs}</tbody>
                        </table>
                    </div>
                </div>`;
        }

        if (b.type === 'definedMetric') {
            const { name, description, formula, requiredConfigs, locations, approvedBy, approvedAt } = b.content;

            return `
                <div id="block-${b.id}" style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin: 24px 0; direction: rtl; font-family: 'Assistant', sans-serif;">
                    <div style="background: linear-gradient(to left, #eef2ff, #ffffff); padding: 16px 24px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; gap: 12px;">
                        <div style="background-color: #e0e7ff; color: #4f46e5; padding: 8px; border-radius: 8px;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.25rem; font-weight: bold; color: #111827; line-height: 1.2;">${name || 'מדד ללא שם'}</h3>
                            ${description ? `<p style="margin: 4px 0 0 0; font-size: 0.875rem; color: #6b7280; line-height: 1.5; white-space: pre-wrap;">${description}</p>` : ''}
                        </div>
                    </div>

                    ${(approvedBy || approvedAt) ? `
                    <div style="background-color: #f0fdf4; padding: 8px 24px; border-bottom: 1px solid #dcfce7; display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: #166534;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>אושר ע"י <strong>${approvedBy || 'לא צוין'}</strong>${approvedAt ? ` ב- ${new Date(approvedAt).toLocaleDateString('he-IL')}` : ''}</span>
                    </div>
                    ` : ''}

                    <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
                        <div>
                            <div style="font-size: 0.75rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                                נוסחה
                            </div>
                            <div style="background-color: #111827; color: #4ade80; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 0.875rem; direction: ltr; text-align: left; overflow-x: auto;">
                                ${formula || '// לא הוגדרה נוסחה'}
                            </div>
                        </div>

                        ${requiredConfigs ? `
                        <div>
                            <div style="font-size: 0.75rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                                הגדרות נדרשות
                            </div>
                            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; font-size: 0.875rem; color: #374151; white-space: pre-wrap;">
                                ${requiredConfigs}
                            </div>
                        </div>
                        ` : ''}

                        ${Array.isArray(locations) && locations.length > 0 ? `
                        <div>
                            <div style="font-size: 0.75rem; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
                                מוגדר ב:
                            </div>
                            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                                <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.875rem;">
                                    <thead style="background-color: #f9fafb; font-size: 0.75rem; color: #6b7280; border-bottom: 1px solid #e5e7eb;">
                                        <tr>
                                            <th style="padding: 8px 12px; font-weight: 600;">מסך</th>
                                            <th style="padding: 8px 12px; font-weight: 600;">מיקום</th>
                                            <th style="padding: 8px 12px; font-weight: 600;">פורמט</th>
                                        </tr>
                                    </thead>
                                    <tbody style="background-color: white;">
                                        ${locations.map((loc: any, idx: number) => `
                                        <tr style="${idx < locations.length - 1 ? 'border-bottom: 1px solid #f3f4f6;' : ''}">
                                            <td style="padding: 10px 12px; color: #111827; font-weight: 500;">${typeof loc === 'string' ? loc : (loc.screen || '-')}</td>
                                            <td style="padding: 10px 12px; color: #4b5563;">${typeof loc === 'string' ? '' : (loc.place || '-')}</td>
                                            <td style="padding: 10px 12px;">
                                                ${(typeof loc !== 'string' && loc.format) ? `<span style="background-color: #f3f4f6; color: #4b5563; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">${loc.format}</span>` : '-'}
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

        if (b.type === 'alert') {
            const icons: any = { info: 'blue', success: 'green', warning: 'yellow', error: 'red' };
            const color = icons[b.content.variant] || 'blue';
            // Simple inline styles for alert
            const bgMap: any = { blue: '#eff6ff', green: '#f0fdf4', yellow: '#fefce8', red: '#fef2f2' };
            const borderMap: any = { blue: '#60a5fa', green: '#4ade80', yellow: '#facc15', red: '#f87171' };
            const textMap: any = { blue: '#1e40af', green: '#166534', yellow: '#854d0e', red: '#991b1b' };

            return `<div style="background-color: ${bgMap[color]}; border-right: 4px solid ${borderMap[color]}; padding: 16px; margin: 16px 0; border-radius: 4px 0 0 4px; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); color: ${textMap[color]};">
                    <div style="font-weight: 600; margin-bottom: 4px;">${b.content.title}</div>
                    <div style="font-size: 0.875rem;">${b.content.text}</div>
                </div>`;
        }

        if (b.type === 'image') {
            const { url, caption, position, size, width, annotations = [], texts } = b.content;
            
            const currentTexts = texts !== undefined 
                ? texts 
                : (caption ? [{ id: Date.now(), text: caption, type: 'text', position: position || 'below' }] : []);

            let sizeClass = 'max-w-md';
            switch (size) {
                case 'small': sizeClass = 'max-w-xs'; break;
                case 'medium': sizeClass = 'max-w-md'; break;
                case 'large': sizeClass = 'max-w-3xl'; break;
                case 'full': sizeClass = 'w-full'; break;
            }
            if (width) sizeClass = '';

            const hasLeft = currentTexts.some((t: any) => t.position === 'left');
            const hasRight = currentTexts.some((t: any) => t.position === 'right');
            const hasSide = hasLeft || hasRight;

            const renderTextsByPosition = (pos: string) => {
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

            const containerClass = `margin: 32px 0; display: flex; flex-direction: column; align-items: center; width: 100%;`;
            
            // Note: In HTML email/static, flex on mobile might not break to wrap correctly if not standard, but we'll use basic flex
            const flexRowDirection = `display: flex; width: 100%; align-items: flex-start; gap: 32px; flex-direction: row; flex-wrap: wrap; justify-content: ${hasSide ? 'space-between' : 'center'};`;
            
            const imgStyle = width ? `width: ${width}px;` : '';
            const imgContainerClass = `position: relative; ${hasSide ? 'flex-shrink: 0;' : 'width: 100%; display: flex; justify-content: center;'} ${width ? '' : (size === 'full' ? 'width: 100%;' : size === 'large' ? 'max-width: 48rem;' : size === 'small' ? 'max-width: 20rem;' : 'max-width: 28rem;')}`;

            const annotationsHtml = `
            <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; color: #dc2626; overflow: visible; z-index: 10;">
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
                if (ann.type === 'filledRect') {
                    return `<rect x="${Math.min(ann.x, ann.x + ann.w)}%" y="${Math.min(ann.y, ann.y + ann.h)}%" width="${Math.abs(ann.w)}%" height="${Math.abs(ann.h)}%" fill="${ann.color || '#0B3F55'}" stroke="none" rx="4" ry="4" />`;
                }
                return '';
            }).join('')}
            </svg>
            ${annotations.map((ann: any) => {
                if (ann.type === 'text') {
                    return `<div style="left: ${ann.x}%; top: ${ann.y}%; z-index: 11; position: absolute; color: #dc2626; font-weight: bold; padding: 0 4px; background-color: rgba(255, 255, 255, 0.7); border-radius: 4px; border: 1px solid #fecaca; font-size: 0.875rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); pointer-events: none; white-space: nowrap;">${ann.text}</div>`;
                }
                return '';
            }).join('')}`;

            return `<div style="${containerClass}" dir="rtl">
                ${renderTextsByPosition('above')}
                <div style="${flexRowDirection}">
                    ${renderTextsByPosition('right')}
                    <div style="${imgContainerClass} ${imgStyle}">
                        ${url ? `
                        <div style="position: relative; display: inline-block; width: 100%;">
                            <img src="${url}" alt="Wiki Image" style="border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; object-fit: contain; width: 100%; height: auto; display: block;" />
                            ${annotationsHtml}
                        </div>
                        ` : `<div style="background-color: #f3f4f6; height: 12rem; width: 100%; display: flex; align-items: center; justify-content: center; color: #9ca3af; border-radius: 12px; border: 1px solid #e5e7eb;">אין תמונה להצגה</div>`}
                    </div>
                    ${renderTextsByPosition('left')}
                </div>
                ${renderTextsByPosition('below')}
            </div>`;
        }

        if (b.type === 'metrics') {
            const metrics = b.content.metrics || [];
            const cards = metrics.map((m: any) => `
                <div style="background-color: white; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); text-align: center;">
                    <div style="font-size: 1.875rem; font-weight: bold; color: #4f46e5; margin-bottom: 4px;">${m.value}</div>
                    <div style="font-size: 0.875rem; font-weight: 500; color: #4b5563;">${m.label}</div>
                    ${m.trend ? `<div style="font-size: 0.75rem; color: ${m.trend > 0 ? '#166534' : '#991b1b'}; margin-top: 8px; font-weight: 600; background-color: #f9fafb; display: inline-block; padding: 2px 8px; border-radius: 4px;">${m.trend > 0 ? '+' : ''}${m.trend}%</div>` : ''}
                </div>`).join('');
            return `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 24px 0;">${cards}</div>`;
        }

        if (b.type === 'checklist') {
            const items = b.content.items || [];
            const list = items.map((item: any) => `
                <div style="display: flex; align-items: start; gap: 12px; padding: 12px; border-radius: 8px; border: 1px solid #f3f4f6; background-color: ${item.checked ? '#f0fdf4' : 'white'}; margin-bottom: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                    <div style="margin-top: 2px; width: 20px; height: 20px; border-radius: 4px; border: 1px solid ${item.checked ? '#22c55e' : '#d1d5db'}; background-color: ${item.checked ? '#22c55e' : 'white'}; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">
                        ${item.checked ? '✓' : ''}
                    </div>
                    <div style="font-weight: 500; color: ${item.checked ? '#9ca3af' : '#1f2937'}; text-decoration: ${item.checked ? 'line-through' : 'none'};">${item.text}</div>
                </div>
            `).join('');
            return `<div style="margin: 24px 0;">${list}</div>`;
        }

        if (b.type === 'file') {
            return `<div style="display: flex; align-items: center; gap: 16px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #f9fafb; margin: 16px 0;">
                <div style="padding: 12px; background-color: white; border-radius: 8px; border: 1px solid #f3f4f6; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); color: #6366f1; font-weight: bold;">
                    FILE
                </div>
                <div>
                    <div style="font-weight: 500; color: #111827;">${b.content.name || 'File'}</div>
                     <div style="font-size: 0.75rem; color: #6b7280;">${(b.content.size / 1024).toFixed(1)} KB • ${b.content.type}</div>
                </div>
                 <a href="${b.content.url}" download style="margin-right: auto; padding: 8px 16px; background-color: white; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.875rem; font-weight: 500; color: #374151; text-decoration: none;">Download</a>
             </div>`;
        }

        if (b.type === 'columns') {
            const cols = b.content.columns || [];
            const colHtml = cols.map((col: any) => `
                <div style="flex: 1; min-width: 300px;">
                    ${col.blocks.map(renderBlock).join('')}
                </div>
            `).join('');
            return `<div style="display: flex; flex-wrap: wrap; gap: 24px; margin: 24px 0;">${colHtml}</div>`;
        }

        if (b.type === 'gantt') {
            const { startDate, phases = [], milestones = [], showHolidays = true, hiddenHolidays = [], manualHolidays = [], cachedHolidays = [], timeMode = 'weeks', defaultShowTasks = true, defaultShowHolidays = true } = b.content;

            const isDaysMode = timeMode === 'days';

            let maxWeek = 4;
            phases.forEach((p: any) => {
                let sW = parseInt(p.startWeek) || 1;
                let dW = parseInt(p.durationWeeks) || 1;
                const ew = p.isMilestone ? sW : sW + dW - 1;
                if (ew > maxWeek) maxWeek = ew;
            });
            milestones.forEach((m: any) => {
                const mw = parseInt(m.week) || 1;
                if (mw > maxWeek) maxWeek = mw;
            });

            const totalColumns = isDaysMode ? maxWeek * 7 : maxWeek;
            const columnsArray = Array.from({ length: totalColumns }, (_, i) => i + 1);

            let currentWeekFloat = -1;
            let currentDayFloat = -1;
            if (startDate) {
                const start = new Date(startDate);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const diffTime = now.getTime() - start.getTime();
                currentDayFloat = (diffTime / (1000 * 60 * 60 * 24)) + 1;
                currentWeekFloat = (currentDayFloat - 1) / 7 + 1;
            }

            const showCurrentLine = isDaysMode ? (currentDayFloat > 0 && currentDayFloat <= totalColumns + 1) : (currentWeekFloat > 0 && currentWeekFloat <= totalColumns + 1);
            const currentLineRightPerc = showCurrentLine ? ((isDaysMode ? (currentDayFloat - 1) : (currentWeekFloat - 1)) / totalColumns) * 100 : 0;

            const allHolidays = [
                ...(Array.isArray(cachedHolidays) ? cachedHolidays : []).map((h: any) => ({ date: h.date, name: h.hebrew || h.title, manual: false })),
                ...(Array.isArray(manualHolidays) ? manualHolidays : []).map((m: any) => ({ date: m.date, name: m.name, manual: true }))
            ].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const getPhaseStartDate = (startWk: number) => {
                if (!startDate) return '';
                const phaseStart = new Date(new Date(startDate).getTime() + (startWk - 1) * 7 * 24 * 60 * 60 * 1000);
                return phaseStart.toLocaleDateString('he-IL');
            };

            const gridLines = columnsArray.map(c => {
                let isWeekend = false;
                if (isDaysMode && startDate) {
                    const d = new Date(startDate);
                    d.setDate(d.getDate() + (c - 1));
                    isWeekend = d.getDay() === 5 || d.getDay() === 6;
                } else if (isDaysMode) {
                    isWeekend = (c % 7 === 6 || c % 7 === 0);
                }
                return `<div style="flex: 1; border-right: 1px solid #f1f5f9; position: relative; ${isWeekend ? 'background-color: rgba(226, 232, 240, 0.4);' : ''}"></div>`;
            }).join('');

            let holidaysHtml = '';
            if (defaultShowHolidays && showHolidays && startDate) {
                const validHolidays = allHolidays.filter(h => !(hiddenHolidays || []).includes(h.date));
                holidaysHtml = validHolidays.map((h: any, i: number) => {
                    const hDate = new Date(h.date);
                    const start = new Date(startDate);
                    const diffTime = hDate.getTime() - start.getTime();
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);
                    const diffWeeks = diffDays / 7;

                    if (diffDays >= 0 && diffDays <= maxWeek * 7) {
                        const rightPerc = isDaysMode ? (diffDays / totalColumns) * 100 : (diffWeeks / totalColumns) * 100;
                        return `
                        <div style="position: absolute; top: 0; bottom: 0; right: ${rightPerc}%; width: 12px; transform: translateX(4px); display: flex; justify-content: center; z-index: 1;">
                            <div style="width: 4px; height: 100%; background-color: rgba(248, 113, 113, 0.2); box-shadow: 0 0 8px rgba(248,113,113,0.5);" title="${h.name} - ${hDate.toLocaleDateString('he-IL')}"></div>
                        </div>`;
                    }
                    return '';
                }).join('');
            }

            const currentLineHtml = showCurrentLine ? `<div style="position: absolute; top: 0; bottom: 0; right: min(calc(30% + ${currentLineRightPerc * 0.7}%), 100%); width: 1px; background-color: #22c55e; opacity: 0.6; z-index: 20; box-shadow: 0 0 8px rgba(34,197,94,0.6);"></div>` : '';

            const phaseRows = phases.map((p: any, index: number) => {
                const sW = parseInt(p.startWeek) || 1;
                const dW = parseInt(p.durationWeeks) || 1;
                const widthPerc = isDaysMode ? ((dW * 7) / totalColumns) * 100 : (dW / totalColumns) * 100;
                const rightPerc = isDaysMode ? (((sW - 1) * 7) / totalColumns) * 100 : ((sW - 1) / totalColumns) * 100;
                const colors = ['#3b82f6', '#6366f1', '#8b5cf6', '#14b8a6', '#0ea5e9', '#0284c7'];
                const barColor = colors[index % colors.length];
                const pStart = getPhaseStartDate(sW);

                if (p.isMilestone) {
                    const mRight = isDaysMode ? (((sW - 1) * 7) / totalColumns) * 100 + ((1 / totalColumns) * 50) : ((sW - 1) / totalColumns) * 100 + ((1 / totalColumns) * 50);
                    return `
                    <div style="margin-bottom: 8px; position: relative; z-index: 10;">
                        <div style="display: flex; align-items: center;">
                            <div style="width: 30%; padding-left: 16px; border-left: 1px solid #e2e8f0; flex-shrink: 0;">
                                <div style="font-weight: bold; color: #15803d; font-size: 14px; margin-bottom: 2px; text-decoration: ${p.isCompleted ? 'line-through' : 'none'}; opacity: ${p.isCompleted ? '0.7' : '1'};">
                                    <div style="display: inline-block; width: 8px; height: 8px; background-color: #22c55e; transform: rotate(45deg); margin-left: 6px;"></div>
                                    ${p.name || 'אבן דרך'}
                                </div>
                                ${pStart ? `<div style="font-size: 10px; color: #64748b; font-weight: 500; margin-right: 14px;">בסביבות: ${pStart}</div>` : ''}
                                ${p.note ? `<div style="font-size: 10px; color: #6b7280; margin-right: 14px; margin-top: 2px;">${p.note}</div>` : ''}
                            </div>
                            <div style="width: 70%; position: relative; height: 40px; display: flex; align-items: center; padding: 0 4px;">
                                <div style="position: absolute; right: ${mRight}%; transform: translateX(50%); display: flex; flex-direction: column; align-items: center; z-index: 20;">
                                    <div style="width: 12px; height: 12px; background-color: #22c55e; transform: rotate(45deg); border: 1px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.1);"></div>
                                    ${p.paymentInfo ? `<div style="position: absolute; top: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: bold; color: #166534; white-space: nowrap;">${p.paymentInfo}</div>` : ''}
                                </div>
                                <div style="position: absolute; left: 0; right: 0; height: 1px; background-color: #f1f5f9; top: 50%;"></div>
                            </div>
                        </div>
                    </div>`;
                }

                return `
                    <div style="margin-bottom: ${defaultShowTasks && p.tasks && p.tasks.length > 0 ? '0' : '8px'}; position: relative; z-index: 10;">
                        <div style="display: flex; align-items: center;">
                            <div style="width: 30%; padding-left: 16px; border-left: 1px solid #e2e8f0; flex-shrink: 0;">
                                <div style="font-weight: bold; color: #1e293b; font-size: 14px; margin-bottom: 2px; text-decoration: ${p.isCompleted ? 'line-through' : 'none'}; opacity: ${p.isCompleted ? '0.7' : '1'};">${p.name || 'ללא שם'}</div>
                                <div style="font-size: 12px; color: #94a3b8; margin-bottom: 2px;">${dW} שבועות</div>
                                ${pStart ? `<div style="font-size: 10px; color: #64748b; font-weight: 500;">מתחיל: ${pStart}</div>` : ''}
                                ${p.note ? `<div style="font-size: 10px; color: #6b7280; margin-top: 2px;">${p.note}</div>` : ''}
                            </div>
                            <div style="width: 70%; position: relative; height: 32px; display: flex; align-items: center; padding: 0 4px;">
                                <div style="position: absolute; right: ${rightPerc}%; width: ${widthPerc}%; height: 24px; background-color: ${barColor}; border-radius: 6px; opacity: 0.9; display: flex; align-items: center; padding-right: 8px;">
                                    ${pStart ? `<span style="color: white; font-size: 10px; font-weight: 500; opacity: 0.9;">${pStart}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        ${defaultShowTasks && p.tasks && p.tasks.length > 0 ? `
                        <div style="padding-right: 16px; padding-left: 48px; position: relative; margin-right: 30%; padding-bottom: 8px;">
                            <div style="position: absolute; right: 0; top: 0; bottom: 8px; width: 1px; background-color: #e2e8f0;"></div>
                            <div style="position: absolute; right: 0; top: 12px; width: 16px; height: 1px; background-color: #e2e8f0;"></div>
                            <div style="background-color: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; display: inline-block; min-width: 60%; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);">
                                <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px;">
                                    ${p.tasks.map((t: any) => `
                                        <li style="font-size: 13px; color: #334155; display: flex; align-items: center; gap: 8px; ${t.isCompleted ? 'text-decoration: line-through; opacity: 0.7;' : ''}">
                                            ${t.isCompleted ? `<div style="width: 12px; height: 12px; color: #16a34a; font-weight: bold; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">✓</div>` : `<div style="width: 6px; height: 6px; border-radius: 50%; background-color: #cbd5e1; flex-shrink: 0; margin: 0 3px;"></div>`}
                                            <span style="flex: 1;">${t.title}</span>
                                            ${t.ticketId ? `<span style="background-color: #f8fafc; border: 1px solid #e2e8f0; color: #64748b; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-family: monospace;" dir="ltr">${t.ticketId}</span>` : ''}
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        </div>` : ''}
                    </div>
                `;
            }).join('');

            const milestoneHtml = (milestones && milestones.length > 0) ? `
            <div style="display: flex; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 24px; position: relative; z-index: 10;">
                <div style="width: 30%; flex-shrink: 0; padding-left: 16px; display: flex; flex-direction: column; justify-content: center;">
                    <div style="font-weight: bold; color: #15803d; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                        אבני דרך (Milestones)
                    </div>
                </div>
                <div style="width: 70%; position: relative; height: 64px;">
                    ${milestones.map((m: any) => {
                const mWeek = parseInt(m.week) || 1;
                const mRight = isDaysMode ? (((mWeek - 1) * 7) / totalColumns) * 100 + ((1 / totalColumns) * 50) : ((mWeek - 1) / totalColumns) * 100 + ((1 / totalColumns) * 50);
                return `
                            <div style="position: absolute; top: 0; right: ${mRight}%; transform: translateX(50%); display: flex; flex-direction: column; align-items: center; z-index: 10;">
                                <div style="width: 2px; height: 16px; background-color: #22c55e; margin-bottom: 4px;"></div>
                                <div style="width: 10px; height: 10px; background-color: #22c55e; transform: rotate(45deg); margin-top: -10px; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); border: 1px solid white;"></div>
                                <div style="background-color: white; border: 1px solid #bbf7d0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-radius: 8px; padding: 6px 12px; font-size: 11px; font-weight: bold; color: #1e293b; white-space: nowrap; text-align: center;">
                                    ${m.name}
                                    ${m.paymentInfo ? `<div style="color: #16a34a; margin-top: 2px; font-size: 10px; background-color: #f0fdf4; padding: 2px 4px; border-radius: 2px;">${m.paymentInfo}</div>` : ''}
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            </div>
        ` : '';

            return `
            <div style="margin: 32px 0; background-color: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);" dir="rtl">
                <div style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
                        <h3 style="margin: 0; font-weight: bold; color: #1e293b; font-size: 18px;">תכנון פרויקט ותכולות</h3>
                    </div>
                    ${startDate ? `<div style="font-size: 14px; font-weight: 500; color: #64748b; background-color: white; padding: 4px 12px; border-radius: 9999px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);">תאריך התחלה: ${new Date(startDate).toLocaleDateString('he-IL')}</div>` : ''}
                </div>
                
                <div style="padding: 24px; overflow-x: auto;">
                    <div style="min-width: ${isDaysMode ? Math.max(800, maxWeek * 7 * 30) : 800}px;">
                        <div style="display: flex; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 24px;">
                            <div style="width: 30%; flex-shrink: 0; font-weight: bold; color: #334155; font-size: 14px;">שלב המערכת / משימות</div>
                            <div style="width: 70%; display: flex; position: relative;">
                                ${columnsArray.map(c => {
                let isWeekend = false;
                let labelContent = isDaysMode ? c : (c === 1 ? 'שבוע 1' : c);
                if (isDaysMode && startDate) {
                    const d = new Date(startDate);
                    d.setDate(d.getDate() + (c - 1));
                    isWeekend = d.getDay() === 5 || d.getDay() === 6;
                    labelContent = `${d.getDate()}/${d.getMonth() + 1}`;
                } else if (isDaysMode) {
                    isWeekend = (c % 7 === 6 || c % 7 === 0);
                }
                return `
                                    <div style="flex: 1; text-align: center; font-weight: bold; font-size: 12px; color: #94a3b8; flex-shrink: 0; border-right: 1px solid #f1f5f9; position: relative; ${isWeekend ? 'background-color: rgba(226, 232, 240, 0.6);' : ''}">
                                        ${labelContent}
                                        ${showCurrentLine && Math.floor(isDaysMode ? currentDayFloat : currentWeekFloat) === c ? `<div style="position: absolute; top: 0; right: 50%; transform: translateX(50%); margin-top: -16px; font-size: 10px; background-color: #dcfce7; color: #166534; padding: 0 4px; border-radius: 4px; border: 1px solid #bbf7d0; z-index: 30;">היום</div>` : ''}
                                    </div>
                                    `;
            }).join('')}
                            </div>
                        </div>

                        <div style="position: relative;">
                            ${phases.length > 0 ? `<div style="position: absolute; top: 0; bottom: 0; right: 30%; left: 0; display: flex; pointer-events: none; z-index: 0;">${gridLines}</div>` : ''}
                            ${phases.length > 0 ? `<div style="position: absolute; top: 0; bottom: 0; right: 30%; left: 0; pointer-events: none; z-index: 1;">${holidaysHtml}</div>` : ''}
                            ${currentLineHtml}
                            ${phaseRows}
                        </div>

                        ${milestoneHtml}
                    </div>
                </div>
            </div>
        `;
        }

        if (b.type === 'contact') {
            const { name, email, phone, role, notes } = b.content;
            return `
            <div style="display: flex; gap: 24px; padding: 24px; background-color: white; border: 1px solid #e5e7eb; border-radius: 12px; margin: 24px 0; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); flex-wrap: wrap;">
                <div style="width: 80px; height: 80px; border-radius: 50%; background: #eff6ff; display: flex; align-items: center; justify-content: center; color: #2563eb; flex-shrink: 0;">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div style="flex: 1; min-width: 250px;">
                    <h3 style="margin: 0; font-size: 1.25rem; font-weight: bold; color: #111827;">${name || 'אין שם'}</h3>
                    <div style="color: #2563eb; font-weight: 500; font-size: 0.875rem; margin-top: 4px;">${role || 'לא צויין תפקיד'}</div>
                    <div style="display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; font-size: 0.875rem; border-top: 1px solid #f3f4f6; border-bottom: 1px solid #f3f4f6; padding: 12px 0;">
                        ${email ? `<a href="mailto:${email}" style="color: #4b5563; text-decoration: none; display: flex; align-items: center; gap: 8px;" dir="ltr"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><rect width="20" height="14" x="2" y="5" rx="2"/></svg> ${email}</a>` : ''}
                        ${phone ? `<a href="tel:${phone}" style="color: #4b5563; text-decoration: none; display: flex; align-items: center; gap: 8px;" dir="ltr"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> ${phone}</a>` : ''}
                    </div>
                    ${notes ? `<div style="margin-top: 12px; font-size: 0.875rem; color: #6b7280; background: #f9fafb; padding: 12px; border-radius: 8px; white-space: pre-wrap;">${notes}</div>` : ''}
                </div>
            </div>`;
        }

        if (b.type === 'connection') {
            const { target, software, address, port, username, password, notes, users = [] } = b.content;
            const userList = users.length > 0 ? users : [{ username, password }];

            return `
            <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 12px; margin: 24px 0; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); overflow: hidden;">
                <div style="background-color: #f9fafb; padding: 16px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 8px; background: #eff6ff; display: flex; align-items: center; justify-content: center; color: #2563eb;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6" y1="6" y2="6"/><line x1="6" x2="6" y1="18" y2="18"/></svg>
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 1rem; font-weight: bold; color: #111827;">${target || 'חיבור ללא שם'}</h3>
                        <div style="font-size: 0.75rem; color: #6b7280; margin-top: 2px;">
                            <span style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${software || 'RDP'}</span>
                        </div>
                    </div>
                </div>
                <div style="padding: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                    <div>
                        <div style="font-size: 0.75rem; font-weight: 600; color: #9ca3af; margin-bottom: 4px;">כתובת השרת</div>
                        <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 0.875rem; color: #374151;" dir="ltr">${address}${port ? ':' + port : ''}</code>
                    </div>
                    <div style="grid-column: 1 / -1; border-top: 1px solid #f3f4f6; padding-top: 16px; margin-top: 8px;">
                        <div style="font-size: 0.75rem; font-weight: 600; color: #9ca3af; margin-bottom: 12px;">פרטי התחברות</div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${userList.map((u: any) => `
                            <div style="display: flex; align-items: center; gap: 16px; background: #f9fafb; padding: 8px 12px; border: 1px solid #f3f4f6; border-radius: 6px; font-size: 0.875rem;">
                                <div style="display: flex; align-items: center; gap: 8px; min-width: 150px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    <span style="font-weight: 500; color: #374151;">${u.username}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="color: #9ca3af; font-size: 0.75rem;">סיסמה:</span>
                                    <code style="background: white; padding: 2px 6px; border: 1px solid #e5e7eb; border-radius: 4px;">${u.password || '••••••••'}</code>
                                </div>
                            </div>
                            `).join('')}
                        </div>
                    </div>
                    ${notes ? `
                    <div style="grid-column: 1 / -1; background: #eff6ff; padding: 12px; border-radius: 8px; font-size: 0.875rem; color: #4b5563; margin-top: 8px; white-space: pre-wrap;">
                        ${notes}
                    </div>
                    ` : ''}
                </div>
            </div>`;
        }

        if (b.type === 'chart') {
            let configStr = '';
            if (typeof b.content.config === 'string') {
                configStr = b.content.config;
            } else {
                configStr = JSON.stringify(b.content.config);
            }
            return `
            <div style="margin: 32px 0; text-align: center; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; background: white; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <img src="https://quickchart.io/chart?w=800&h=400&c=${encodeURIComponent(configStr)}" alt="Chart" style="max-width: 100%; height: auto;" />
            </div>`;
        }

        if (b.type === 'reportTable') {
            const { rows: rawRows = [], headers = [], columnDefs: savedColumnDefs = [], filterableCols = [] } = b.content;

            const columnDefs = (savedColumnDefs.length === headers.length) ? savedColumnDefs : headers.map((h: string) => ({
                name: h, explanation: '', formula: '', width: 'auto', widthMode: 'auto', notes: '', isFilterable: filterableCols.includes(h)
            }));

            const getColumnStyleHtmlString = (cDef: any, isHeader = false): string => {
                const w = cDef.width;
                const mode = cDef.widthMode || 'auto';
                if (isHeader) {
                    const minW = w && w !== 'auto' ? `max(${w}, max-content)` : 'max-content';
                    return `width: ${w}; min-width: ${minW}; white-space: nowrap;`;
                }
                if (mode === 'auto') return `white-space: normal; word-break: break-word;`;
                const base = `width: ${w}; min-width: ${w}; max-width: ${w};`;
                if (mode === 'wrap') return `${base} white-space: normal; word-break: break-word;`;
                if (mode === 'truncate') return `${base} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
                if (mode === 'shrink') return `${base} white-space: nowrap; overflow: hidden; font-size: 0.85em; letter-spacing: -0.3px; text-overflow: ellipsis;`;
                return base;
            };

            const headersHtml = columnDefs.map((c: any) => {
                const titleAttr = c.explanation || c.notes ? ` title="${c.explanation}${c.notes ? ' | ' + c.notes : ''}"` : '';
                return `<th${titleAttr} style="padding: 14px 16px; font-weight: 700; border-right: 1px solid #e2e8f0; ${getColumnStyleHtmlString(c, true)}">${c.name}</th>`;
            }).join('');

            const staticRowsHtml = rawRows.map((r: any, i: number) => `
            <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
                ${r.cells.map((cText: string, j: number) => `<td style="padding: 12px 16px; border-right: 1px solid #e2e8f0; color: #475569; ${getColumnStyleHtmlString(columnDefs[j])}">${cText || ''}</td>`).join('')}
            </tr>`).join('');

            return `
            <div style="margin: 32px 0; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); background: white;">
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: right; direction: rtl;">
                        <thead style="background-color: #f8fafc; color: #334155; border-bottom: 3px solid #cbd5e1;">
                            <tr>${headersHtml}</tr>
                        </thead>
                        <tbody>${staticRowsHtml}</tbody>
                    </table>
                </div>
            </div>`;
        }

        if (b.type === 'callout') {
            return `<div style="background-color: #f9fafb; border-right: 4px solid #1f2937; padding: 24px; margin: 24px 0; font-family: serif; font-size: 1.125rem; font-style: italic; color: #374151; border-radius: 4px 0 0 4px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                "${b.content.text}"
             </div>`;
        }

        if (b.type === 'hero') {
            return `<div style="background: linear-gradient(to right, #4f46e5, #9333ea); color: white; padding: 48px; border-radius: 16px; margin: 32px 0; text-align: center; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">
                <h1 style="font-size: 2.25rem; font-weight: 800; margin-bottom: 16px; line-height: 1.2;">${b.content.title}</h1>
                <div style="font-size: 1.25rem; opacity: 0.9;">${b.content.subtitle}</div>
             </div>`;
        }

        if (b.content.html) return `<div>${b.content.html}</div>`; // Fallback for raw HTML

        // Fallback for unknown block types
        return `<div style="background-color: #f3f4f6; padding: 16px; border: 1px dashed #d1d5db; border-radius: 4px; text-align: center; color: #6b7280; margin: 16px 0;">Unknown Block Type: ${b.type}</div>`;
    };

    const contentHtml = data.blocks.map(renderBlock).join('');

    // Generate TOC
    const tocHeaders: any[] = [];
    data.blocks.forEach((b: any, index: number) => {
        if (b.type === 'header' && [1, 2, 3].includes(b.content.level)) {
            const id = `header-${index}`;
            b.id = id; // assigning temporary ID for TOC
            tocHeaders.push({
                id,
                text: b.content.text,
                level: b.content.level,
                index
            });
        }
    });

    const hasToc = tocHeaders.length > 0;

    // add IDs to headers in content
    const contentHtmlWithIds = data.blocks.map((b: any, index: number) => {
        if (b.type === 'header' && [1, 2, 3].includes(b.content.level)) {
            const level = b.content.level;
            const sizeMap: any = { 1: '1.875rem', 2: '1.5rem', 3: '1.25rem', 4: '1.125rem' };
            const styles = `font-weight: bold; color: #111827; margin-bottom: 1rem; font-size: ${sizeMap[level] || '1rem'}; ${level === 2 ? 'border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem;' : ''}`;
            return `<h${level} id="header-${index}" style="${styles}">${b.content.text}</h${level}>`;
        }
        return renderBlock(b);
    }).join('');

    const tocHtml = hasToc ? `
        <!-- Mobile TOC Toggle Button -->
        <button id="toc-toggle" class="toc-toggle-btn" aria-label="Toggle Table of Contents">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
        </button>
        
        <!-- Sidebar TOC -->
        <div id="toc-sidebar" class="toc-sidebar">
            <h4 style="font-weight: bold; color: #1f2937; margin-top: 0; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f3f4f6;">תוכן עניינים</h4>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${tocHeaders.map((header: any) => {
        let style = 'text-align: right; text-decoration: none; transition: color 0.2s; padding: 4px 0; display: block;';
        if (header.level === 1) style += ' font-weight: bold; color: #111827; margin-top: 8px;';
        else if (header.level === 2) style += ' font-weight: 600; color: #1f2937; padding-right: 8px; border-right: 2px solid #e0e7ff;';
        else if (header.level === 3) style += ' color: #4b5563; padding-right: 20px; font-size: 13px;';
        else style += ' color: #6b7280; padding-right: 32px; font-size: 12px;';

        return `<a href="#${header.id}" style="${style}" onmouseover="this.style.color='#2563eb'" onmouseout="this.style.color=''" onclick="closeMobileToc()">
                                ${header.text}
                            </a>`;
    }).join('')}
            </div>
        </div>
        <!-- Overlay for mobile -->
        <div id="toc-overlay" class="toc-overlay" onclick="closeMobileToc()"></div>
    ` : '';


    return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title}</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Assistant', sans-serif; direction: rtl; text-align: right; background-color: #f9fafb; margin: 0; padding: 0; color: #111827; }
        .main-content { max-width: 1500px; margin: 40px auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        
        /* Header Style */
        .iso-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1D4A5C; padding-bottom: 15px; margin-bottom: 30px; }
        .iso-header .logo { flex-shrink: 0; margin-right: 20px; }
        .iso-header .logo img { height: 60px; width: auto; object-fit: contain; }
        .iso-header .text-details { flex-grow: 1; text-align: right; }
        .iso-header h1 { margin: 0; font-size: 26px; color: #1D4A5C; font-weight: bold; line-height: 1.2; }
        .iso-header .meta-row { display: flex; gap: 20px; font-size: 13px; color: #555; margin-top: 8px; flex-wrap: wrap; }
        .iso-header .meta-row span { display: inline-flex; align-items: center; gap: 6px; }
        
        /* Footer / Watermark */
        .iso-footer { display: none; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 50px; font-size: 10px; color: #888; }
        
        /* Print Styles */
        @media print {
            body { background: white; }
            .main-content { box-shadow: none; margin: 0; padding: 0; width: 100%; max-width: 100%; }
            .iso-footer { 
                display: block; 
                position: fixed; 
                bottom: 0; 
                left: 0; 
                right: 0; 
                background: white; 
                padding: 10px; 
            }
            .no-print { display: none; }
            /* Ensure background colors print */
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        
        /* Custom Scrollbar for Code Blocks */
        pre::-webkit-scrollbar { height: 8px; }
        pre::-webkit-scrollbar-track { background: #1f2937; }
        pre::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 4px; }
        
        /* Links */
        a { color: #2563eb; text-decoration: none; }
        a:hover { text-decoration: underline; }

        /* Layout with TOC */
        .page-wrapper { display: flex; gap: 30px; position: relative; align-items: flex-start; }
        .content-area { flex: 1; min-width: 0; }
        
        /* Table of Contents */
        .toc-sidebar {
            position: sticky;
            top: 40px;
            width: 250px;
            flex-shrink: 0;
            background: rgba(255,255,255,0.95);
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            max-height: calc(100vh - 80px);
            overflow-y: auto;
            transition: transform 0.3s ease;
            z-index: 40;
        }

        .toc-toggle-btn {
            display: none;
            position: fixed;
            bottom: 24px;
            left: 24px;
            background: #1D4A5C;
            color: white;
            border: none;
            border-radius: 50%;
            width: 56px;
            height: 56px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 50;
            cursor: pointer;
            align-items: center;
            justify-content: center;
        }

        .toc-overlay {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 30;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        /* Mobile Adjustments */
        @media (max-width: 1024px) {
            .page-wrapper { display: block; }
            .toc-toggle-btn { display: flex; }
            .toc-sidebar {
                position: fixed;
                top: 0;
                left: 0;
                bottom: 0;
                max-height: 100vh;
                height: 100vh;
                width: 280px;
                border-radius: 0;
                transform: translateX(-100%);
            }
            .toc-sidebar.open {
                transform: translateX(0);
            }
            .toc-overlay.open {
                display: block;
                opacity: 1;
            }
        }
    </style>
</head>
<body>
    <div class="main-content">
        <!-- ISO 9001 Header -->
        <header class="iso-header">
            <div class="text-details">
                 <h1>${data.title}</h1>
                 <div class="meta-row">
                      <span><strong>עודכן:</strong> ${new Date(data.metadata.updatedAt || Date.now()).toLocaleDateString('he-IL')} ${new Date(data.metadata.updatedAt || Date.now()).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span><strong>ע"י:</strong> ${data.metadata.updatedBy || 'מערכת'}</span>
                      ${data.metadata.status ? `<span><strong>סטטוס:</strong> ${data.metadata.status}</span>` : ''}
                 </div>
            </div>
            <div class="logo">
                 ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : '<img src="/logo.png" alt="Logo" style="height: 48px; object-fit: contain;" />'}
            </div>
        </header>

        <!-- Content Area with TOC -->
        <div class="page-wrapper">
            <div class="content-area">
                ${contentHtmlWithIds}
            </div>
            ${tocHtml}
        </div>

        <!-- Footer -->
        <div class="iso-footer">
            <div>Uncontrolled Copy when Printed - Check System for Latest Version</div>
            <div>Generated on ${new Date().toLocaleDateString('he-IL')}</div>
        </div>
    </div>
    <script>
        function downloadTableCSV(tableId, filename) {
            var table = document.getElementById(tableId);
            if (!table) return;
            var csv = '\\uFEFF';
            var rows = table.querySelectorAll('tr');
            for (var i = 0; i < rows.length; i++) {
                var cols = rows[i].querySelectorAll('td, th');
                var rowData = [];
                for (var j = 0; j < cols.length; j++) {
                    var text = cols[j].innerText.replace(/"/g, '""');
                    rowData.push('"' + text + '"');
                }
                csv += rowData.join(',') + '\\n';
            }
            var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename + '.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        // Mobile TOC Toggle Logic
        document.addEventListener('DOMContentLoaded', function() {
            var toggleBtn = document.getElementById('toc-toggle');
            var sidebar = document.getElementById('toc-sidebar');
            var overlay = document.getElementById('toc-overlay');

            if (toggleBtn && sidebar && overlay) {
                toggleBtn.addEventListener('click', function() {
                    sidebar.classList.toggle('open');
                    overlay.classList.toggle('open');
                });
            }
        });

        function closeMobileToc() {
            var sidebar = document.getElementById('toc-sidebar');
            var overlay = document.getElementById('toc-overlay');
            if (sidebar && overlay && window.innerWidth <= 1024) {
               sidebar.classList.remove('open');
               overlay.classList.remove('open');
            }
        }
    </script>
</body>
</html>`;
};

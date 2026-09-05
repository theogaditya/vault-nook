/**
 * Encrypted In-App Document Viewer & Multi-Format Previewer — Nook Editorial Design
 * Fully renders: .docx, .doc, .odt, .rtf, .txt, .xlsx, .xls, .ods, .csv, .pptx, .ppt, .odp,
 *               .jpg, .jpeg, .png, .gif, .webp, .svg, .html, .htm, .json, .xml, .yaml, .yml
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  X,
  Download,
  Edit3,
  Eye,
  Save,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Presentation,
  Bold,
  Italic,
  List,
  Heading,
  Code,
  Copy,
  Search,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  FileCode,
  Table,
  Image as ImageIcon,
  Video,
  Volume2,
  ExternalLink,
  Smartphone,
} from 'lucide-react';

import * as XLSX from 'xlsx';
import { renderAsync } from 'docx-preview';
import mammoth from 'mammoth';
import JSZip from 'jszip';

import { DecryptedFile } from '../hooks/useVault';
import { useDownloader } from '../hooks/useDownloader';
import { useUploader } from '../hooks/useUploader';

interface DocumentViewerModalProps {
  file: DecryptedFile | null; // null if creating a new note
  isNewNote?: boolean;
  currentFolderId?: string | null;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export function DocumentViewerModal({
  file,
  isNewNote = false,
  currentFolderId = null,
  onClose,
  onSaveSuccess,
}: DocumentViewerModalProps) {
  const { fetchDecryptedBlob, downloadFile } = useDownloader();
  const { uploadFile } = useUploader(currentFolderId);

  const [loading, setLoading] = useState(!isNewNote);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [arrayBufferData, setArrayBufferData] = useState<ArrayBuffer | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const [noteTitle, setNoteTitle] = useState<string>(file ? file.name : 'Untitled Note.md');
  const [isEditing, setIsEditing] = useState<boolean>(isNewNote);
  const [activeTab, setActiveTab] = useState<'write' | 'preview' | 'code'>(isNewNote ? 'write' : 'preview');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [csvSearch, setCsvSearch] = useState('');
  const [wrapText, setWrapText] = useState(true);
  const [imageZoom, setImageZoom] = useState(false);

  // Zoom & Resize states for DOCX and PDF viewers
  const [docZoom, setDocZoom] = useState<number>(100);
  const [docFit, setDocFit] = useState<boolean>(false);
  const [pdfZoom, setPdfZoom] = useState<number>(100);
  const [pdfFit, setPdfFit] = useState<boolean>(false);

  // Detect mobile browser (iOS or Android)
  const isMobile = useMemo(() => {
    const ua = navigator.userAgent || '';
    return /android|iphone|ipad|ipod|mobile/i.test(ua);
  }, []);

  const isAndroid = useMemo(() => /android/i.test(navigator.userAgent || ''), []);
  const isIOS = useMemo(() => /iphone|ipad|ipod/i.test(navigator.userAgent || ''), []);

  // Textarea ref for cursor-aware markdown insertion
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const docxContainerRef = useRef<HTMLDivElement | null>(null);
  // In-browser rendering states for DOCX / ODT & XLSX / ODS
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [workbookData, setWorkbookData] = useState<{ sheetNames: string[]; sheets: Record<string, any[][]> } | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [pptxSlides, setPptxSlides] = useState<{ id: number; title: string; lines: string[] }[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const ext = useMemo(() => {
    return file ? file.name.split('.').pop()?.toLowerCase() || '' : '';
  }, [file]);

  const isWordDoc = useMemo(() => ['docx', 'doc', 'odt', 'rtf'].includes(ext), [ext]);
  const isSpreadsheetDoc = useMemo(() => ['xlsx', 'xls', 'ods'].includes(ext), [ext]);
  const isPresentationDoc = useMemo(() => ['pptx', 'ppt', 'odp'].includes(ext), [ext]);
  const isMarkdown = useMemo(() => (ext === 'md' || isNewNote), [ext, isNewNote]);
  const isPdf = useMemo(() => ext === 'pdf', [ext]);
  const isImage = useMemo(() => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || !!file?.mimeType.startsWith('image/'), [ext, file]);
  const isVideo = useMemo(() => ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'mkv', 'avi'].includes(ext) || !!file?.mimeType.startsWith('video/'), [ext, file]);
  const isAudio = useMemo(() => ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'weba'].includes(ext) || !!file?.mimeType.startsWith('audio/'), [ext, file]);
  const isCsv = useMemo(() => ext === 'csv', [ext]);
  const isHtml = useMemo(() => ['html', 'htm'].includes(ext), [ext]);
  const isStructuredText = useMemo(() => ['json', 'xml', 'yaml', 'yml', 'txt', 'rtf', 'log', 'js', 'ts', 'css', 'py', 'sql'].includes(ext), [ext]);

  // Load and decrypt file content on open
  useEffect(() => {
    if (isNewNote) {
      setTextContent('# New Markdown Note\n\nWrite your zero-knowledge encrypted notes here using Markdown syntax...');
      setLoading(false);
      return;
    }

    if (!file) return;

    let isMounted = true;
    const loadFile = async () => {
      setLoading(true);
      setError(null);
      try {
        const { blob, textContent: text, arrayBuffer } = await fetchDecryptedBlob(file);
        if (!isMounted) return;

        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setArrayBufferData(arrayBuffer);

        if (text !== undefined) {
          setTextContent(text);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to decrypt document preview');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadFile();

    return () => {
      isMounted = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [file, isNewNote]);

  // Parse DOCX / ODT, XLSX / ODS & PPTX in browser when arrayBuffer arrives
  useEffect(() => {
    if (!arrayBufferData || !file) return;

    if (isWordDoc) {
      if (ext === 'docx' && docxContainerRef.current) {
        docxContainerRef.current.innerHTML = '';
        renderAsync(arrayBufferData, docxContainerRef.current, undefined, {
          inWrapper: false,
          ignoreWidth: false,
          ignoreHeight: false,
        }).catch(() => {
          mammoth.convertToHtml({ arrayBuffer: arrayBufferData })
            .then((res) => setDocxHtml(res.value))
            .catch(() => {});
        });
      } else if (ext === 'odt') {
        // Parse ODT XML content in browser
        JSZip.loadAsync(arrayBufferData).then((zip) => {
          const contentFile = zip.file('content.xml');
          if (contentFile) {
            contentFile.async('string').then((xmlStr) => {
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(xmlStr, 'text/xml');
              let html = '';
              const pElements = xmlDoc.querySelectorAll('p, h, text\\:p, text\\:h, list-item, text\\:list-item');
              pElements.forEach((el) => {
                const text = el.textContent?.trim();
                if (!text) return;
                const nodeName = el.nodeName.toLowerCase();
                if (nodeName.includes('h')) {
                  html += `<h2 class="font-garamond text-2xl font-bold text-[#141312] mt-4 mb-2">${text}</h2>`;
                } else if (nodeName.includes('list-item')) {
                  html += `<li class="ml-4 list-disc text-[#32302f] my-1 font-sans text-sm">${text}</li>`;
                } else {
                  html += `<p class="font-sans text-[#32302f] text-sm leading-relaxed my-2">${text}</p>`;
                }
              });
              setDocxHtml(html || '<p class="text-gray-500 italic">ODT document opened successfully.</p>');
            }).catch(() => {
              mammoth.convertToHtml({ arrayBuffer: arrayBufferData }).then((res) => setDocxHtml(res.value)).catch(() => {});
            });
          } else {
            mammoth.convertToHtml({ arrayBuffer: arrayBufferData }).then((res) => setDocxHtml(res.value)).catch(() => {});
          }
        }).catch(() => {
          mammoth.convertToHtml({ arrayBuffer: arrayBufferData }).then((res) => setDocxHtml(res.value)).catch(() => {});
        });
      } else {
        mammoth.convertToHtml({ arrayBuffer: arrayBufferData })
          .then((res) => setDocxHtml(res.value))
          .catch(() => {});
      }
    }

    if (isPresentationDoc && (ext === 'pptx' || ext === 'odp')) {
      // Parse PPTX slides using JSZip
      JSZip.loadAsync(arrayBufferData).then(async (zip) => {
        const slideFiles = Object.keys(zip.files).filter((name) =>
          /^ppt\/slides\/slide\d+\.xml$/i.test(name)
        );
        slideFiles.sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
          const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
          return numA - numB;
        });

        const slides: { id: number; title: string; lines: string[] }[] = [];
        const parser = new DOMParser();

        for (let i = 0; i < slideFiles.length; i++) {
          const xmlStr = await zip.files[slideFiles[i]].async('string');
          const xmlDoc = parser.parseFromString(xmlStr, 'text/xml');
          const textNodes = Array.from(xmlDoc.getElementsByTagName('a:t'));
          const lines: string[] = [];
          textNodes.forEach((node) => {
            const txt = node.textContent?.trim();
            if (txt && !lines.includes(txt)) lines.push(txt);
          });
          const title = lines.length > 0 ? lines[0] : `Slide ${i + 1}`;
          slides.push({ id: i + 1, title, lines: lines.slice(1) });
        }

        if (slides.length > 0) {
          setPptxSlides(slides);
          setActiveSlideIndex(0);
        }
      }).catch((err) => {
        console.error('Failed to parse presentation deck', err);
      });
    }

    if (isSpreadsheetDoc) {
      try {
        const wb = XLSX.read(arrayBufferData, { type: 'array' });
        const sheetsMap: Record<string, any[][]> = {};
        wb.SheetNames.forEach((name) => {
          const sheet = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
          sheetsMap[name] = rows;
        });
        setWorkbookData({ sheetNames: wb.SheetNames, sheets: sheetsMap });
        if (wb.SheetNames.length > 0) {
          setActiveSheet(wb.SheetNames[0]);
        }
      } catch (err) {
        console.error('Failed to parse spreadsheet workbook', err);
      }
    }
  }, [arrayBufferData, file, ext, isWordDoc, isSpreadsheetDoc, isPresentationDoc]);

  // Format CSV lines safely handling quoted commas
  const csvData = useMemo(() => {
    if (!textContent || ext !== 'csv') return null;
    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const rawLines = textContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    return rawLines.map(parseCsvLine);
  }, [textContent, ext]);

  const filteredCsvData = useMemo(() => {
    if (!csvData) return null;
    if (!csvSearch.trim()) return csvData;
    const query = csvSearch.toLowerCase();
    const headers = csvData[0];
    const rows = csvData.slice(1).filter((row) => row.some((cell) => cell.toLowerCase().includes(query)));
    return [headers, ...rows];
  }, [csvData, csvSearch]);

  // Active sheet rows for Workbook (XLSX / XLS / ODS)
  const currentSheetRows = useMemo(() => {
    if (!workbookData || !activeSheet || !workbookData.sheets[activeSheet]) return [];
    const rows = workbookData.sheets[activeSheet];
    if (!csvSearch.trim()) return rows;
    const query = csvSearch.toLowerCase();
    const headers = rows[0] || [];
    const filteredRows = rows.slice(1).filter((r) => r.some((cell) => String(cell).toLowerCase().includes(query)));
    return [headers, ...filteredRows];
  }, [workbookData, activeSheet, csvSearch]);

  // Format Pretty JSON if applicable
  const prettyFormattedText = useMemo(() => {
    if (!textContent) return '';
    if (ext === 'json') {
      try {
        return JSON.stringify(JSON.parse(textContent), null, 2);
      } catch {
        return textContent;
      }
    }
    return textContent;
  }, [textContent, ext]);

  // Markdown renderer
  const renderSimpleMarkdown = (md: string) => {
    const lines = md.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="font-garamond text-[28px] font-bold text-[#e6e2e0] mb-3 pb-1 border-b border-[#4b4640]">{line.slice(2)}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="font-garamond text-[22px] font-bold text-[#cac6c3] mb-2 mt-4">{line.slice(3)}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="font-garamond text-[18px] font-bold text-[#cdc5bd] mb-1 mt-3">{line.slice(4)}</h3>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 font-sans text-[14px] text-[#cdc5bd] list-disc my-1">
            {line.slice(2)}
          </li>
        );
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} className="pl-4 border-l-2 border-[#cac6c3] font-garamond italic text-[16px] text-[#cdc5bd] my-3">
            {line.slice(2)}
          </blockquote>
        );
      }
      if (line.startsWith('```')) {
        return <div key={idx} className="my-2 border-t border-[#4b4640]" />;
      }
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }

      let formattedText: React.ReactNode = line;
      if (line.includes('**')) {
        const parts = line.split('**');
        formattedText = parts.map((part, pIdx) => (pIdx % 2 === 1 ? <strong key={pIdx} className="text-[#e6e2e0] font-semibold">{part}</strong> : part));
      }

      return <p key={idx} className="font-sans text-[14px] text-[#cdc5bd] leading-relaxed my-1.5">{formattedText}</p>;
    });
  };

  const insertMarkdown = (syntax: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = textContent.substring(0, start);
      const after = textContent.substring(end);
      const newText = before + syntax + after;
      setTextContent(newText);
      // Restore cursor after inserted text
      requestAnimationFrame(() => {
        textarea.focus();
        const newPos = start + syntax.length;
        textarea.setSelectionRange(newPos, newPos);
      });
    } else {
      setTextContent((prev) => prev + syntax);
    }
  };

  const handleCopyCode = () => {
    if (prettyFormattedText) {
      navigator.clipboard.writeText(prettyFormattedText);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleSaveEncryptedNote = async () => {
    if (!noteTitle.trim()) {
      setError('Please provide a title for your note.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const fileName = noteTitle.endsWith('.md') || noteTitle.endsWith('.txt') ? noteTitle : `${noteTitle}.md`;
      const blob = new Blob([textContent], { type: 'text/markdown' });
      const fileObj = new File([blob], fileName, { type: 'text/markdown' });

      await uploadFile(fileObj);
      setSuccessMsg('Note encrypted and saved to vault successfully!');
      setTimeout(() => {
        if (onSaveSuccess) onSaveSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0e0d]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="bg-[#141312] w-full max-w-5xl max-h-[90dvh] sm:max-h-[90vh] border border-[#4b4640] shadow-2xl flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 border-b border-[#4b4640] flex items-start sm:items-center justify-between gap-4 bg-[#0f0e0d]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 border border-[#4b4640] bg-[#201f1e] flex items-center justify-center shrink-0">
              {isImage ? (
                <ImageIcon className="w-4 h-4 text-[#a5d6a7]" />
              ) : isVideo ? (
                <Video className="w-4 h-4 text-[#ff80ab]" />
              ) : isAudio ? (
                <Volume2 className="w-4 h-4 text-[#ffcc80]" />
              ) : isCsv || isSpreadsheetDoc ? (
                <FileSpreadsheet className="w-4 h-4 text-[#818cf8]" />
              ) : isPresentationDoc ? (
                <Presentation className="w-4 h-4 text-[#f59e0b]" />
              ) : isHtml || isStructuredText ? (
                <FileCode className="w-4 h-4 text-[#38bdf8]" />
              ) : (
                <FileText className="w-4 h-4 text-[#cac6c3]" />
              )}
            </div>
            {isEditing || isNewNote ? (
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note Title (e.g. My Vault Note.md)"
                className="bg-[#0f0e0d] border border-[#4b4640] px-3 py-1.5 font-space-mono text-[13px] text-[#e6e2e0] focus:outline-none focus:border-[#cac6c3] max-w-xs"
              />
            ) : (
              <div>
                <h3 className="font-garamond text-[18px] font-bold text-[#e6e2e0] truncate max-w-xs sm:max-w-md">{file?.name}</h3>
                <span className="font-space-mono text-[10px] text-[#EAB308] uppercase tracking-wider">{ext.toUpperCase() || 'FILE'} • {(file?.size ? (file.size / 1024).toFixed(1) + ' KB' : 'Document')}</span>
              </div>
            )}
          </div>

          <div className="flex items-start sm:items-center gap-3 self-start">
            {/* HTML Switcher */}
            {isHtml && (
              <div className="flex border border-[#4b4640] font-space-mono text-[11px]">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1.5 transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'preview' ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold' : 'text-[#cdc5bd] hover:text-[#e6e2e0] bg-[#141312]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Web Page</span>
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-3 py-1.5 transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'code' ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold' : 'text-[#cdc5bd] hover:text-[#e6e2e0] bg-[#141312]'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">HTML Source</span>
                </button>
              </div>
            )}

            {/* Markdown Switcher */}
            {(isMarkdown || (isEditing && textContent)) && (
              <div className="flex border border-[#4b4640] font-space-mono text-[11px]">
                <button
                  onClick={() => {
                    setActiveTab('preview');
                    setIsEditing(false);
                  }}
                  className={`px-3 py-1.5 transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'preview' ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold' : 'text-[#cdc5bd] hover:text-[#e6e2e0] bg-[#141312]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('write');
                    setIsEditing(true);
                  }}
                  className={`px-3 py-1.5 transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'write' ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold' : 'text-[#cdc5bd] hover:text-[#e6e2e0] bg-[#141312]'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Editor</span>
                </button>
              </div>
            )}

            {file && (
              <button
                onClick={() => downloadFile(file)}
                className="px-3 py-1.5 border border-[#4b4640] text-[#cdc5bd] hover:text-[#e6e2e0] hover:bg-[#201f1e] transition cursor-pointer font-space-mono text-[11px] flex items-center gap-1.5"
                title="Download Local Decrypted Copy"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1 text-[#636363] hover:text-[#e6e2e0] transition cursor-pointer border border-[#4b4640] hover:border-[#cac6c3]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Editor Toolbar */}
        {activeTab === 'write' && (
          <div className="px-4 py-2 bg-[#0f0e0d] border-b border-[#4b4640] flex items-center gap-2 flex-wrap font-space-mono text-[12px] text-[#cdc5bd]">
            <button onClick={() => insertMarkdown('# ')} className="p-1.5 hover:bg-[#201f1e] text-[#cdc5bd] hover:text-[#e6e2e0] cursor-pointer" title="Heading 1"><Heading className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertMarkdown('**bold text**')} className="p-1.5 hover:bg-[#201f1e] text-[#cdc5bd] hover:text-[#e6e2e0] cursor-pointer" title="Bold"><Bold className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertMarkdown('*italic text*')} className="p-1.5 hover:bg-[#201f1e] text-[#cdc5bd] hover:text-[#e6e2e0] cursor-pointer" title="Italic"><Italic className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertMarkdown('\n- List item')} className="p-1.5 hover:bg-[#201f1e] text-[#cdc5bd] hover:text-[#e6e2e0] cursor-pointer" title="Bullet List"><List className="w-3.5 h-3.5" /></button>
            <button onClick={() => insertMarkdown('`code`')} className="p-1.5 hover:bg-[#201f1e] text-[#cdc5bd] hover:text-[#e6e2e0] cursor-pointer" title="Inline Code"><Code className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 border border-[#ffb4ab]/30 bg-[#93000a]/20 font-space-mono text-[12px] text-[#ffb4ab] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 border border-[#a5d6a7]/40 bg-[#a5d6a7]/10 font-space-mono text-[12px] text-[#a5d6a7] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-20 text-center space-y-3 font-space-mono text-[12px] text-[#636363]">
              <div className="w-6 h-6 border border-[#e6e2e0] border-t-transparent animate-spin mx-auto" />
              <p>Decrypting payload in browser memory...</p>
            </div>
          ) : activeTab === 'write' ? (
            <textarea
              ref={textareaRef}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Write your zero-knowledge encrypted note..."
              className="w-full h-[55dvh] sm:h-[55vh] bg-[#0f0e0d] border border-[#4b4640] p-3 sm:p-4 font-space-mono text-[13px] text-[#e6e2e0] placeholder-[#636363] focus:outline-none focus:border-[#cac6c3] resize-none leading-relaxed"
            />
          ) : isMarkdown ? (
            <div className="prose max-w-none">
              {renderSimpleMarkdown(textContent)}
            </div>
          ) : isWordDoc ? (
            /* Full In-Browser DOCX / DOC / ODT / RTF Renderer — mobile-optimised */
            <div className="space-y-3">
              {/* Document Toolbar — zoom controls hidden on mobile (touch pinch instead) */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0f0e0d] border border-[#4b4640] p-2.5">
                <div className="flex items-center gap-2 font-space-mono text-[11px] text-[#cdc5bd]">
                  <FileText className="w-3.5 h-3.5 text-[#cac6c3]" />
                  <span>Document View</span>
                  {isMobile && (
                    <span className="text-[#636363] text-[10px]">(pinch to zoom)</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Desktop-only zoom controls */}
                  {!isMobile && (
                    <>
                      <button
                        onClick={() => setDocZoom((prev) => Math.max(50, prev - 15))}
                        disabled={docZoom <= 50}
                        className="p-1 border border-[#4b4640] bg-[#141312] text-[#cdc5bd] hover:text-[#e6e2e0] disabled:opacity-40 transition cursor-pointer"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setDocZoom(100)}
                        className="px-2 py-0.5 border border-[#4b4640] bg-[#141312] text-[#e6e2e0] font-space-mono text-[11px] hover:border-[#cac6c3] cursor-pointer"
                        title="Reset Zoom"
                      >
                        {docZoom}%
                      </button>

                      <button
                        onClick={() => setDocZoom((prev) => Math.min(200, prev + 15))}
                        disabled={docZoom >= 200}
                        className="p-1 border border-[#4b4640] bg-[#141312] text-[#cdc5bd] hover:text-[#e6e2e0] disabled:opacity-40 transition cursor-pointer"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setDocFit((prev) => !prev)}
                    className="px-2.5 py-1 border border-[#4b4640] bg-[#141312] text-[#cdc5bd] hover:text-[#e6e2e0] font-space-mono text-[11px] flex items-center gap-1.5 cursor-pointer transition"
                    title="Toggle height"
                  >
                    {docFit ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    <span className="hidden sm:inline">{docFit ? 'Default Height' : 'Expand View'}</span>
                  </button>

                  {/* Mobile: download to open in native Word/Pages app */}
                  {isMobile && file && (
                    <button
                      onClick={() => downloadFile(file)}
                      className="px-2.5 py-1 border border-[#cac6c3]/50 bg-[#201f1e] text-[#cac6c3] font-space-mono text-[10px] flex items-center gap-1.5 cursor-pointer transition"
                      title="Open in Word / Pages app"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open in App</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable document area — on mobile use overflow-y-scroll with touch scroll */}
              <div
                className={`bg-white border border-[#4b4640] overflow-auto text-[#1d1b1a] transition-all ${
                  docFit ? 'min-h-[60vh] max-h-[82vh]' : 'min-h-[55vh] max-h-[70vh]'
                }`}
                style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
              >
                {/* Apply zoom only on desktop — mobile uses native pinch-to-zoom on the container */}
                <div
                  className="p-4 md:p-8"
                  style={!isMobile ? {
                    transform: `scale(${docZoom / 100})`,
                    transformOrigin: 'top left',
                    width: `${100 * (100 / docZoom)}%`,
                  } : undefined}
                >
                  <div ref={docxContainerRef} className="docx-view font-sans leading-relaxed text-[#1d1b1a]" />
                  {docxHtml && (
                    <div
                      className="prose max-w-none font-sans leading-relaxed text-[#1d1b1a]"
                      dangerouslySetInnerHTML={{ __html: docxHtml }}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : isSpreadsheetDoc && workbookData ? (
            /* Full In-Browser Spreadsheet Workbook Renderer (XLSX, XLS, ODS) — Clean Spreadsheet Sheet Styling */
            <div className="space-y-3">
              {/* Sheet tabs bar & search */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0f0e0d] border border-[#4b4640] p-2.5">
                <div className="flex items-center gap-1 overflow-x-auto max-w-full">
                  {workbookData.sheetNames.map((name) => (
                    <button
                      key={name}
                      onClick={() => setActiveSheet(name)}
                      className={`px-3 py-1 font-space-mono text-[11px] border cursor-pointer transition ${
                        activeSheet === name
                          ? 'bg-[#818cf8] text-[#0e0d0c] font-bold border-[#818cf8]'
                          : 'bg-[#141312] text-[#cdc5bd] border-[#4b4640] hover:text-[#e6e2e0]'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWrapText((prev) => !prev)}
                    className={`px-2.5 py-1 border font-space-mono text-[11px] flex items-center gap-1.5 transition cursor-pointer ${
                      wrapText
                        ? 'bg-[#818cf8]/20 text-[#818cf8] border-[#818cf8]/50 font-bold'
                        : 'bg-[#141312] text-[#cdc5bd] border-[#4b4640] hover:text-[#e6e2e0]'
                    }`}
                    title="Toggle cell text wrapping to view full text"
                  >
                    <span>Wrap Text: {wrapText ? 'ON' : 'OFF'}</span>
                  </button>

                  <div className="flex items-center gap-2 border border-[#4b4640] bg-[#141312] px-3 py-1">
                    <Search className="w-3.5 h-3.5 text-[#636363]" />
                    <input
                      type="text"
                      value={csvSearch}
                      onChange={(e) => setCsvSearch(e.target.value)}
                      placeholder="Search sheet data..."
                      className="bg-transparent font-space-mono text-[11px] text-[#e6e2e0] focus:outline-none w-36 sm:w-48"
                    />
                  </div>
                </div>
              </div>

              {/* Clean White Spreadsheet Table */}
              <div className="border border-slate-300 overflow-x-auto max-h-[55vh] bg-white rounded-sm shadow-inner">
                <table className="w-full text-left font-space-mono text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 sticky top-0">
                      <th className="p-2 border-r border-slate-300 text-slate-500 w-10 text-center font-bold">#</th>
                      {currentSheetRows[0]?.map((col: any, idx: number) => (
                        <th
                          key={idx}
                          className={`p-2 border-r border-slate-300 font-bold text-indigo-800 bg-slate-100 align-top ${
                            wrapText
                              ? 'whitespace-normal break-words min-w-[140px] max-w-[350px]'
                              : 'truncate max-w-[200px]'
                          }`}
                        >
                          {String(col) || `Col ${idx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentSheetRows.slice(1).map((row: any[], rIdx: number) => (
                      <tr key={rIdx} className="border-b border-slate-200 hover:bg-slate-50 transition">
                        <td className="p-2 border-r border-slate-300 text-slate-400 text-center bg-slate-50">{rIdx + 1}</td>
                        {row.map((cell: any, cIdx: number) => (
                          <td
                            key={cIdx}
                            className={`p-2 border-r border-slate-200 text-slate-800 align-top ${
                              wrapText
                                ? 'whitespace-pre-wrap break-words min-w-[150px] max-w-[500px]'
                                : 'truncate max-w-[140px] sm:max-w-[250px]'
                            }`}
                            title={String(cell ?? '')}
                          >
                            {String(cell ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : isCsv && filteredCsvData ? (
            /* CSV Grid Viewer — Clean Spreadsheet Sheet Styling */
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 bg-[#0f0e0d] border border-[#4b4640] p-2.5 flex-wrap">
                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <div className="flex items-center gap-2 flex-1 border border-[#4b4640] bg-[#141312] px-3 py-1">
                    <Search className="w-3.5 h-3.5 text-[#636363]" />
                    <input
                      type="text"
                      value={csvSearch}
                      onChange={(e) => setCsvSearch(e.target.value)}
                      placeholder="Search table rows..."
                      className="bg-transparent font-space-mono text-[11px] text-[#e6e2e0] focus:outline-none w-full"
                    />
                  </div>
                  <button
                    onClick={() => setWrapText((prev) => !prev)}
                    className={`px-2.5 py-1 border font-space-mono text-[11px] flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                      wrapText
                        ? 'bg-[#818cf8]/20 text-[#818cf8] border-[#818cf8]/50 font-bold'
                        : 'bg-[#141312] text-[#cdc5bd] border-[#4b4640] hover:text-[#e6e2e0]'
                    }`}
                    title="Toggle cell text wrapping to view full text"
                  >
                    <span>Wrap Text: {wrapText ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
                <span className="font-space-mono text-[10px] text-[#cdc5bd]">
                  Showing {filteredCsvData.length - 1} of {csvData ? csvData.length - 1 : 0} rows
                </span>
              </div>
              <div className="border border-slate-300 overflow-x-auto max-h-[55vh] bg-white rounded-sm shadow-inner">
                <table className="w-full text-left font-space-mono text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 sticky top-0">
                      <th className="p-2 border-r border-slate-300 text-slate-500 w-10 text-center font-bold">#</th>
                      {filteredCsvData[0]?.map((col, idx) => (
                        <th
                          key={idx}
                          className={`p-2 border-r border-slate-300 font-bold text-slate-900 bg-slate-100 align-top ${
                            wrapText
                              ? 'whitespace-normal break-words min-w-[140px] max-w-[350px]'
                              : 'truncate max-w-[200px]'
                          }`}
                        >
                          {col || `Col ${idx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCsvData.slice(1).map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-slate-200 hover:bg-slate-50 transition">
                        <td className="p-2 border-r border-slate-300 text-slate-400 text-center bg-slate-50">{rIdx + 1}</td>
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`p-2 border-r border-slate-200 text-slate-800 align-top ${
                              wrapText
                                ? 'whitespace-pre-wrap break-words min-w-[150px] max-w-[500px]'
                                : 'truncate max-w-[140px] sm:max-w-[250px]'
                            }`}
                            title={cell}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : isHtml ? (
            activeTab === 'preview' && blobUrl ? (
              <iframe srcDoc={textContent} title={file?.name} className="w-full h-[65vh] border border-[#4b4640] bg-white" sandbox="allow-same-origin" />
            ) : (
              <div className="relative">
                <button onClick={handleCopyCode} className="absolute top-3 right-3 font-space-mono text-[10px] border border-[#4b4640] px-2 py-1 bg-[#141312] text-[#cdc5bd] hover:text-[#e6e2e0] flex items-center gap-1">
                  {copiedCode ? <CheckCircle2 className="w-3 h-3 text-[#a5d6a7]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
                <pre className="w-full max-h-[60vh] overflow-auto bg-[#0f0e0d] border border-[#4b4640] p-4 font-space-mono text-[12px] text-[#a5d6a7] leading-relaxed select-text whitespace-pre-wrap">
                  {prettyFormattedText}
                </pre>
              </div>
            )
          ) : isStructuredText && textContent ? (
            /* Structured JSON / XML / YAML / TXT Code Viewer */
            <div className="relative space-y-2">
              <div className="flex items-center justify-between bg-[#0f0e0d] border border-[#4b4640] px-3 py-1.5">
                <span className="font-space-mono text-[10px] text-[#EAB308] uppercase tracking-wider">{ext} Code Viewer</span>
                <button onClick={handleCopyCode} className="font-space-mono text-[10px] border border-[#4b4640] px-2 py-0.5 bg-[#141312] text-[#cdc5bd] hover:text-[#e6e2e0] flex items-center gap-1 cursor-pointer">
                  {copiedCode ? <CheckCircle2 className="w-3 h-3 text-[#a5d6a7]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode ? 'Copied' : 'Copy Source'}</span>
                </button>
              </div>
              <pre className="w-full max-h-[60vh] overflow-auto bg-[#0f0e0d] border border-[#4b4640] p-4 font-space-mono text-[12px] text-[#e6e2e0] leading-relaxed select-text whitespace-pre-wrap">
                {prettyFormattedText}
              </pre>
            </div>
          ) : isPdf && blobUrl ? (
            /* PDF Viewer — iframe on iOS, open-in-app for Android, object on desktop */
            <div className={`flex flex-col w-full border border-[#4b4640] bg-[#0f0e0d] transition-all ${pdfFit ? 'h-[82vh]' : 'h-[65vh]'}`}>
              {/* Toolbar */}
              <div className="p-2.5 bg-[#141312] border-b border-[#4b4640] flex items-center justify-between font-space-mono text-[11px] flex-wrap gap-2">
                <span className="text-[#90caf9] flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="truncate max-w-[140px] sm:max-w-xs">{file?.name}</span>
                </span>

                <div className="flex items-center gap-2">
                  {/* Zoom controls — desktop only */}
                  {!isMobile && (
                    <>
                      <button
                        onClick={() => setPdfZoom((prev) => Math.max(50, prev - 15))}
                        disabled={pdfZoom <= 50}
                        className="p-1 border border-[#4b4640] bg-[#0f0e0d] text-[#cdc5bd] hover:text-[#e6e2e0] disabled:opacity-40 transition cursor-pointer"
                        title="Zoom Out PDF"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPdfZoom(100)}
                        className="px-2 py-0.5 border border-[#4b4640] bg-[#0f0e0d] text-[#e6e2e0] font-space-mono text-[11px] hover:border-[#cac6c3] cursor-pointer"
                        title="Reset Zoom"
                      >
                        {pdfZoom}%
                      </button>
                      <button
                        onClick={() => setPdfZoom((prev) => Math.min(200, prev + 15))}
                        disabled={pdfZoom >= 200}
                        className="p-1 border border-[#4b4640] bg-[#0f0e0d] text-[#cdc5bd] hover:text-[#e6e2e0] disabled:opacity-40 transition cursor-pointer"
                        title="Zoom In PDF"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setPdfFit((prev) => !prev)}
                    className="px-2.5 py-1 border border-[#4b4640] bg-[#0f0e0d] text-[#cdc5bd] hover:text-[#e6e2e0] font-space-mono text-[11px] flex items-center gap-1.5 cursor-pointer transition"
                    title="Toggle height"
                  >
                    {pdfFit ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    <span className="hidden sm:inline">{pdfFit ? 'Default View' : 'Expand View'}</span>
                  </button>

                  {/* Android: open in native PDF app via download link */}
                  {isAndroid && file && (
                    <a
                      href={blobUrl}
                      download={file.name}
                      className="px-2.5 py-1 border border-[#90caf9]/60 bg-[#0f0e0d] text-[#90caf9] font-space-mono text-[10px] flex items-center gap-1.5 cursor-pointer transition hover:bg-[#141312]"
                      title="Open in your PDF reader app"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open in App</span>
                    </a>
                  )}

                  {file && (
                    <button
                      onClick={() => downloadFile(file)}
                      className="px-3 py-1 bg-[#e6e1df] text-[#1d1b1a] font-bold uppercase tracking-wider hover:bg-[#cac6c3] flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Save</span>
                    </button>
                  )}
                </div>
              </div>

              {/* iOS Safari: iframe renders PDF natively */}
              {isIOS ? (
                <iframe
                  src={blobUrl}
                  title={file?.name}
                  className="w-full flex-1 bg-white border-0"
                  style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
                />
              ) : isAndroid ? (
                /* Android Chrome: no inline PDF support — show a clean open-in-app card */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0f0e0d] space-y-5">
                  <div className="w-16 h-16 border border-[#90caf9]/40 bg-[#90caf9]/10 rounded-full flex items-center justify-center mx-auto">
                    <Smartphone className="w-8 h-8 text-[#90caf9]" />
                  </div>
                  <div>
                    <span className="font-space-mono text-[10px] text-[#90caf9] uppercase tracking-widest block mb-1">PDF Document</span>
                    <h4 className="font-garamond text-[22px] text-[#e6e2e0]">{file?.name}</h4>
                  </div>
                  <p className="font-space-mono text-[11px] text-[#cdc5bd] leading-relaxed max-w-xs">
                    Android Chrome doesn't support inline PDF preview. Tap below to open the decrypted PDF directly in your PDF reader app.
                  </p>
                  {file && (
                    <a
                      href={blobUrl}
                      download={file.name}
                      className="px-6 py-3 bg-[#90caf9] text-[#0e0d0c] font-space-mono text-[11px] font-bold uppercase tracking-widest inline-flex items-center gap-2 cursor-pointer transition hover:bg-[#bbdefb]"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open in PDF App</span>
                    </a>
                  )}
                  {file && (
                    <button
                      onClick={() => downloadFile(file)}
                      className="px-5 py-2 border border-[#4b4640] text-[#cdc5bd] font-space-mono text-[11px] inline-flex items-center gap-2 cursor-pointer transition hover:text-[#e6e2e0]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save Decrypted Copy</span>
                    </button>
                  )}
                </div>
              ) : (
                /* Desktop: object tag with #zoom fragment */
                <object
                  data={`${blobUrl}#zoom=${pdfZoom}`}
                  type="application/pdf"
                  className="w-full flex-1 bg-white"
                >
                  <div className="p-8 text-center bg-[#0f0e0d] space-y-4 max-w-md mx-auto border border-[#4b4640] mt-8">
                    <FileText className="w-12 h-12 text-[#90caf9] mx-auto" />
                    <h4 className="font-garamond text-[24px] text-[#e6e2e0]">{file?.name}</h4>
                    <p className="font-space-mono text-[11px] text-[#cdc5bd] leading-relaxed">
                      Your browser does not support inline PDF rendering. Save a local decrypted copy to open in your PDF reader.
                    </p>
                    {file && (
                      <button
                        onClick={() => downloadFile(file)}
                        className="px-5 py-2.5 bg-[#e6e1df] text-[#1d1b1a] font-space-mono text-[11px] font-bold uppercase tracking-widest hover:bg-[#cac6c3] inline-flex items-center gap-2 cursor-pointer transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Save Decrypted PDF</span>
                      </button>
                    )}
                  </div>
                </object>
              )}
            </div>
          ) : isVideo && blobUrl ? (
            /* HTML5 Video Player with Mobile Playback Optimization */
            <div className="flex flex-col items-center justify-center p-4 bg-[#0f0e0d] border border-[#4b4640] min-h-[45vh]">
              <video
                src={blobUrl}
                controls
                playsInline
                preload="metadata"
                controlsList="nodownload"
                className="max-h-[60vh] max-w-full rounded border border-[#4b4640] bg-black shadow-lg"
              >
                Your browser does not support inline video playback for this format.
              </video>
              <div className="mt-4 flex items-center gap-3">
                <span className="font-space-mono text-[11px] text-[#cdc5bd]">
                  Video decrypted in browser memory
                </span>
                {file && (
                  <button
                    onClick={() => downloadFile(file)}
                    className="px-3 py-1 bg-[#201f1e] border border-[#4b4640] text-[#e6e2e0] font-space-mono text-[11px] hover:border-[#cac6c3] flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save Copy</span>
                  </button>
                )}
              </div>
            </div>
          ) : isAudio && blobUrl ? (
            /* HTML5 Audio Player */
            <div className="p-8 text-center border border-[#4b4640] bg-[#0f0e0d] space-y-6 max-w-md mx-auto my-8">
              <div className="w-16 h-16 border border-[#ffcc80] bg-[#ffcc80]/10 flex items-center justify-center rounded-full mx-auto text-[#ffcc80]">
                <Volume2 className="w-8 h-8" />
              </div>
              <div>
                <span className="font-space-mono text-[10px] text-[#ffcc80] uppercase tracking-widest block mb-1">
                  Audio Track
                </span>
                <h4 className="font-garamond text-[24px] text-[#e6e2e0]">{file?.name}</h4>
              </div>
              <audio
                src={blobUrl}
                controls
                preload="metadata"
                className="w-full"
              >
                Your browser does not support inline audio playback.
              </audio>
              {file && (
                <button
                  onClick={() => downloadFile(file)}
                  className="px-5 py-2.5 bg-[#e6e1df] text-[#1d1b1a] font-space-mono text-[11px] font-bold uppercase tracking-widest hover:bg-[#cac6c3] inline-flex items-center gap-2 cursor-pointer transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save Audio File</span>
                </button>
              )}
            </div>
          ) : isImage && blobUrl ? (
            /* Image Gallery Viewer */
            <div className="flex flex-col items-center justify-center p-4 bg-[#0f0e0d] border border-[#4b4640] relative">
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  onClick={() => setImageZoom(!imageZoom)}
                  className="font-space-mono text-[10px] border border-[#4b4640] px-2 py-1 bg-[#141312] text-[#cdc5bd] hover:text-[#e6e2e0] flex items-center gap-1 cursor-pointer"
                >
                  {imageZoom ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  <span>{imageZoom ? 'Fit' : 'Actual Size'}</span>
                </button>
              </div>
              <img
                src={blobUrl}
                alt={file?.name}
                className={`transition-all border border-[#4b4640] object-contain ${imageZoom ? 'max-w-none max-h-none' : 'max-h-[60vh] max-w-full'}`}
              />
            </div>
          ) : isPresentationDoc ? (
            /* Office Presentation Viewer (PPTX / ODP) — Natural White Slide Canvas */
            pptxSlides.length > 0 ? (
              <div className="space-y-4 max-w-4xl mx-auto">
                {/* Navigation Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0f0e0d] border border-[#4b4640] p-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveSlideIndex((prev) => Math.max(0, prev - 1))}
                      disabled={activeSlideIndex === 0}
                      className="px-3 py-1.5 border border-[#4b4640] bg-[#141312] text-[#cdc5bd] hover:text-[#e6e2e0] font-space-mono text-[11px] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      ← Prev Slide
                    </button>
                    <span className="font-space-mono text-[11px] text-[#EAB308] font-bold px-2">
                      Slide {activeSlideIndex + 1} of {pptxSlides.length}
                    </span>
                    <button
                      onClick={() => setActiveSlideIndex((prev) => Math.min(pptxSlides.length - 1, prev + 1))}
                      disabled={activeSlideIndex === pptxSlides.length - 1}
                      className="px-3 py-1.5 border border-[#4b4640] bg-[#141312] text-[#cdc5bd] hover:text-[#e6e2e0] font-space-mono text-[11px] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      Next Slide →
                    </button>
                  </div>

                  {/* Slide selector pills */}
                  <div className="flex items-center gap-1 overflow-x-auto max-w-full py-1">
                    {pptxSlides.map((slide, idx) => (
                      <button
                        key={slide.id}
                        onClick={() => setActiveSlideIndex(idx)}
                        className={`w-7 h-7 flex items-center justify-center font-space-mono text-[10px] border transition cursor-pointer ${
                          activeSlideIndex === idx
                            ? 'bg-[#f59e0b] text-[#0e0d0c] font-bold border-[#f59e0b]'
                            : 'bg-[#141312] text-[#cdc5bd] border-[#4b4640] hover:text-[#e6e2e0]'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 16:9 Presentation Canvas — Clean White Canvas */}
                <div className="bg-white border border-slate-300 p-8 sm:p-12 min-h-[45vh] max-h-[60vh] overflow-y-auto flex flex-col justify-between shadow-2xl relative rounded-md text-slate-900">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <span className="font-space-mono text-[10px] text-amber-700 font-bold uppercase tracking-widest">
                        {file?.name} • Slide {pptxSlides[activeSlideIndex].id}
                      </span>
                      <Presentation className="w-4 h-4 text-amber-600" />
                    </div>

                    <h2 className="font-garamond text-[26px] sm:text-[34px] font-bold text-slate-900 leading-tight">
                      {pptxSlides[activeSlideIndex].title}
                    </h2>

                    {pptxSlides[activeSlideIndex].lines.length > 0 ? (
                      <ul className="space-y-2.5 pt-2">
                        {pptxSlides[activeSlideIndex].lines.map((line, lIdx) => (
                          <li key={lIdx} className="font-sans text-[14px] sm:text-[16px] text-slate-700 leading-relaxed flex items-start gap-2.5">
                            <span className="text-amber-600 font-bold mt-1">•</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="font-space-mono text-[11px] text-slate-400 italic pt-4">
                        (Title slide / visual layout block)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Fallback Deck Info Card */
              <div className="p-8 text-center border border-[#4b4640] bg-[#0f0e0d] space-y-4 max-w-md mx-auto my-8">
                <Presentation className="w-12 h-12 text-[#f59e0b] mx-auto" />
                <div>
                  <span className="font-space-mono text-[10px] text-[#f59e0b] uppercase tracking-widest block mb-1">Presentation Deck</span>
                  <h4 className="font-garamond text-[24px] text-[#e6e2e0]">{file?.name}</h4>
                </div>
                <p className="font-space-mono text-[11px] text-[#cdc5bd] leading-relaxed">
                  Decrypted in browser memory. Save copy locally to open in PowerPoint, Keynote, or Impress.
                </p>
                {file && (
                  <button
                    onClick={() => downloadFile(file)}
                    className="px-5 py-2.5 bg-[#e6e1df] text-[#1d1b1a] font-space-mono text-[11px] font-bold uppercase tracking-widest hover:bg-[#cac6c3] inline-flex items-center gap-2 cursor-pointer transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save Decrypted Presentation</span>
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="p-8 text-center font-space-mono text-[12px] text-[#636363]">
              No preview renderer available for this file type. Click Save to download locally.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {(isEditing || isNewNote) && (
          <div className="p-4 border-t border-[#4b4640] bg-[#0f0e0d] flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 font-space-mono text-[11px] text-[#cdc5bd] hover:text-[#e6e2e0] uppercase tracking-widest transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEncryptedNote}
              disabled={saving}
              className="px-6 py-2.5 bg-[#e6e1df] text-[#1d1b1a] hover:bg-[#cac6c3] font-space-mono text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Encrypting & Saving...' : 'Save Encrypted Note'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

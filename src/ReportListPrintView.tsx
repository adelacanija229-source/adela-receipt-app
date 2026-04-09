import React from 'react';
import { createPortal } from 'react-dom';

export const ReportListPrintView = ({ reports, onClose }: { reports: any[], onClose: () => void }) => {
  const formatKRW = (n: number | string | undefined) => {
    if (!n) return '0';
    return Number(n.toString().replace(/,/g, '')).toLocaleString('ko-KR');
  };

  const formatDate = (ts: any) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const totalAmount = reports.reduce((sum, r) => sum + Number((r.amount||'0').toString().replace(/,/g, '')), 0);

  return createPortal(
    <div className="report-print-overlay" style={styles.overlay}>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        @media print {
          #root { display: none !important; }
          html, body {
            margin: 0 !important; padding: 0 !important; background: #fff !important; width: 100%; height: auto;
          }
          .report-print-overlay {
            position: static !important; display: block !important; width: 100%;
          }
          .print-controls { display: none !important; }
          .a4-page-content {
            box-shadow: none !important;
            margin: 0 !important;
            width: 100% !important;
            padding: 0 !important; /* 브라우저 여백 활용 */
          }
        }
        .report-print-overlay::-webkit-scrollbar { width: 8px; }
        .report-print-overlay::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
        
        .compact-table { width: 100%; border-collapse: collapse; font-family: 'Pretendard', sans-serif; table-layout: fixed; word-break: keep-all; }
        .compact-table th, .compact-table td { border: 1px solid #333; padding: 5px 4px; font-size: 0.75rem; text-align: center; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: pre-wrap; }
        .compact-table th { background-color: #f2f2f2; font-weight: bold; }
        .text-left { text-align: left !important; }
        .text-right { text-align: right !important; }
        .fw-bold { font-weight: bold !important; }
      `}</style>

      <div className="print-controls" style={styles.controls}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: '1rem', fontWeight: 800 }}>📄 영수증 내역 리스트 인쇄 미리보기</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => window.print()} style={styles.printBtn}>인쇄하기 (PDF 저장)</button>
          <button onClick={onClose} style={styles.closeBtn}>닫기</button>
        </div>
      </div>

      <div className="a4-page-content" style={{ background: '#fff', width: '210mm', minHeight: '297mm', padding: '15mm', margin: '20px auto', boxSizing: 'border-box', boxShadow: '0 0 20px rgba(0,0,0,0.2)', color: '#000' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px', letterSpacing: '3px' }}>영 수 증 내 역 목 록</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.85rem', fontWeight: 'bold' }}>
          <span>총 {reports.length}건</span>
          <span>합계: ₩ {formatKRW(totalAmount)}</span>
        </div>
        
        <table className="compact-table">
          <thead>
            <tr>
              <th style={{ width: '4%' }}>No</th>
              <th style={{ width: '13%' }}>영수증(증빙)</th>
              <th style={{ width: '10%' }}>일자</th>
              <th style={{ width: '11%' }}>현장명</th>
              <th style={{ width: '7%' }}>성명</th>
              <th style={{ width: '15%' }}>사용처</th>
              <th style={{ width: '9%' }}>결제카드</th>
              <th style={{ width: '18%' }}>목적/내용</th>
              <th style={{ width: '13%' }}>금액</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r, i) => (
              <tr key={r.id || i}>
                <td>{i + 1}</td>
                <td style={{ padding: '2px' }}>
                  {r.imageUrl ? (
                    <img src={r.imageUrl} alt="영수증" style={{ width: '100%', maxHeight: '75px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                  ) : (
                    <span style={{ fontSize: '0.6rem', color: '#999' }}>미첨부</span>
                  )}
                </td>
                <td style={{ fontSize: '0.65rem' }}>{formatDate(r.createdAt)}</td>
                <td>{r.site}</td>
                <td style={{ wordBreak: 'break-all' }}>{r.name}</td>
                <td className="text-left" style={{ fontSize: '0.65rem' }}>{r.merchant}</td>
                <td>{r.cardLast4 ? `*${r.cardLast4}` : '-'}</td>
                <td className="text-left" style={{ fontSize: '0.65rem' }}>{r.purpose}</td>
                <td className="text-right fw-bold">{formatKRW(r.amount)}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>,
    document.body
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    background: '#555', zIndex: 9999, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', alignItems: 'center'
  },
  controls: {
    position: 'sticky', top: 0, width: '100%',
    background: '#fff', padding: '12px 24px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 10001
  },
  printBtn: {
    background: '#9c2c2c', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold'
  },
  closeBtn: {
    background: '#f5f5f5', color: '#333', border: '1px solid #ccc', padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold'
  }
};

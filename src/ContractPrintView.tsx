import React from 'react';
import { createPortal } from 'react-dom';

// 계약서 데이터 인터페이스
export interface Contract {
  id: string;
  workerName: string;
  workerIdNum: string;
  workerPhone: string;
  workerAddress: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  siteName: string;
  workType: string;
  startDate: string;
  endDate: string;
  dailyWage: number;
  wageBreakdown: {
    base: number;
    overtime: number;
    holiday: number;
    weekly: number;
  };
  managerName: string;
  signatureUrl: string;
  idCardUrl?: string; 
  mealReceiptUrl?: string; 
  status: string;
  createdAt: any;
}

export const ContractPrintView = ({ contract, onClose }: { contract: Contract; onClose: () => void }) => {

  const formatKRW = (n: number | undefined) => (n || 0).toLocaleString('ko-KR');

  const parseDate = () => {
    let d = new Date();
    if (contract.createdAt?.toDate) {
      d = contract.createdAt.toDate();
    } else if (contract.startDate) {
      d = new Date(contract.startDate);
    }
    return {
      year: d.getFullYear(),
      month: String(d.getMonth() + 1).padStart(2, '0'),
      date: String(d.getDate()).padStart(2, '0')
    };
  };

  const cDate = parseDate();

  return createPortal(
    <div className="contract-print-overlay" style={styles.overlay}>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          #root { display: none !important; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }

          .contract-print-overlay {
            position: static !important;
            display: block !important;
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
          }

          .print-controls, .version-marker, .screen-only-badge { 
            display: none !important; 
          }

          #print-root { 
            display: block !important;
            background: #fff !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .page-container {
            display: block !important;
            width: 100% !important;
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .page-container:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .a4-page { 
            display: block !important;
            width: 210mm !important;
            min-height: 296mm !important; 
            height: auto !important; 
            padding: 3mm 6mm !important;
            margin: 0 auto !important;
            border: none !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            transform: scale(0.98);
            transform-origin: top center;
          }
          
          .attachment-box {
            border: 0.5pt solid #333 !important;
            padding: 10px !important;
          }
        }

        .contract-print-overlay::-webkit-scrollbar { width: 8px; }
        .contract-print-overlay::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
        
        .premium-table td {
          border: 1px solid #000;
          padding: 1px 4px;
          font-size: 0.66rem;
          line-height: 1.1;
          height: auto;
          vertical-align: middle;
        }
        .premium-table th {
          background-color: #f2f2f2;
          font-weight: bold;
          text-align: center;
          vertical-align: middle;
          letter-spacing: 1px;
          word-break: keep-all;
        }
        .vertical-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          line-height: 1.0;
          padding: 1px 0;
        }
      `}</style>

      {/* 상단 컨트롤 (화면용) */}
      <div className="print-controls" style={styles.controls}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: '1rem', fontWeight: 800 }}>📄 근로계약서 인쇄 미리보기</span>
          <span style={{ fontSize: '0.7rem', color: '#666' }}>(이미지와 동일한 정석 레이아웃 적용됨)</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => window.print()} style={styles.printBtn}>인쇄하기 (PDF 저장)</button>
          <button onClick={onClose} style={styles.closeBtn}>닫기</button>
        </div>
      </div>

      <div id="print-root" style={{ background: '#f0f0f0', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
        
        {/* ─── 1페이지: 근로계약서 본문 ─── */}
        <div className="page-container">
          <div className="a4-page" style={styles.page}>
            <div style={{ textAlign: 'center', marginBottom: '3px' }}>
              <h1 style={{ 
                display: 'inline-block',
                border: '2px solid #000',
                padding: '2px 25px',
                fontSize: '1.3rem',
                letterSpacing: '10px',
                fontWeight: 900,
                margin: '0'
              }}>일 용 근 로 계 약 서 (40h)</h1>
            </div>

            {/* 사용자/근로자 정보 테이블 */}
            <table className="premium-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
              <tbody>
                <tr>
                  <th rowSpan={2} style={{ width: '10%', verticalAlign: 'middle' }}>
                    <div className="vertical-label" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                      <span>(</span>
                      <span>甲</span>
                      <span>)</span>
                      <span style={{ marginTop: '2px' }}>사</span>
                      <span>용</span>
                      <span>자</span>
                    </div>
                  </th>
                  <td style={{ width: '12%', textAlign: 'center', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>상 호</td>
                  <td colSpan={3} style={{ width: '43%', textAlign: 'center', fontWeight: 'bold', fontSize: '0.75rem' }}>㈜ 아 델 라</td>
                  <td style={{ width: '15%', textAlign: 'center', backgroundColor: '#f2f2f2' }}>현장소장</td>
                  <td style={{ width: '20%', textAlign: 'center' }}>{contract.managerName || '배병선'}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'center', backgroundColor: '#f2f2f2' }}>주 소</td>
                  <td colSpan={3} style={{ textAlign: 'center', fontSize: '0.62rem' }}>서울 강남구 학동로 11길 56 백송B/D 2층</td>
                  <td style={{ textAlign: 'center', backgroundColor: '#f2f2f2' }}>전 화</td>
                  <td style={{ textAlign: 'center' }}>02-2281-0456</td>
                </tr>
                <tr>
                  <th rowSpan={3} style={{ verticalAlign: 'middle' }}>
                    <div className="vertical-label" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                      <span>(</span>
                      <span>乙</span>
                      <span>)</span>
                      <span style={{ marginTop: '2px' }}>근</span>
                      <span>로</span>
                      <span>자</span>
                    </div>
                  </th>
                  <td style={{ textAlign: 'center', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>성 명</td>
                  <td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.75rem' }}>{contract.workerName}</td>
                  <td style={{ textAlign: 'center', backgroundColor: '#f2f2f2' }}>주민등록번호</td>
                  <td style={{ textAlign: 'center' }}>{contract.workerIdNum}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'center', backgroundColor: '#f2f2f2' }}>주 소</td>
                  <td colSpan={3} style={{ textAlign: 'center', fontSize: '0.62rem' }}>{contract.workerAddress}</td>
                  <td style={{ textAlign: 'center', backgroundColor: '#f2f2f2' }}>핸드폰 번호</td>
                  <td style={{ textAlign: 'center' }}>{contract.workerPhone}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'center', backgroundColor: '#f2f2f2' }}>계 좌 번 호</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{contract.bankAccount}</td>
                  <td style={{ textAlign: 'center', width: '80px' }}>은행 : {contract.bankName}</td>
                  <td colSpan={3} style={{ textAlign: 'right' }}>예금주 : {contract.bankHolder}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ textAlign: 'center', padding: '1px 0', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px' }}>
              아래의 근로 조건을 성실히 이행할 것을 약정하고 근로계약을 체결한다.
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.65rem', marginBottom: '2px' }}>
              ― &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 아 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 래 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ―
            </div>

            {/* 메인 근로조건 테이블 */}
            <table className="premium-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
              <tbody>
                <tr>
                  <th style={{ width: '12%', verticalAlign: 'middle', padding: '2px 0' }}>
                    <div className="vertical-label" style={{ fontSize: '0.7rem' }}>
                      <span>근</span>
                      <span>로</span>
                      <span>장</span>
                      <span>소</span>
                    </div>
                  </th>
                  <td>각 현 장 ( 현장명 : <strong>{contract.siteName}</strong> )</td>
                </tr>
                <tr>
                  <th style={{ verticalAlign: 'middle', padding: '2px 0' }}>
                    <div className="vertical-label" style={{ fontSize: '0.7rem' }}>
                      <span>계</span>
                      <span>약</span>
                      <span>기</span>
                      <span>간</span>
                    </div>
                  </th>
                  <td style={{ fontSize: '0.62rem', padding: '1px 4px' }}>
                    공사 예정기간 : <strong>{contract.startDate?.replace(/-/g, ' . ')}</strong> ~ <strong>{contract.endDate?.replace(/-/g, ' . ')}</strong> &nbsp;&nbsp; ( 개월 )<br/>
                    1. 甲과 乙의 근로 계약 관계는 1일 단위로 근로관계가 생성되는 일용직 근로계약 관계이나, 실무적 편의를 위해 근로조건의 변함이 없고 甲과 乙 간에 이의가 없다면 별도의 계약 절차 없이 동일한 계약이 갱신된 것으로 본다. <br/>
                    2. 甲과 乙은 당해 공사 기간 중 이라도 1일 전에 일방이 재 계약을 거부할 수 있다. <br/>
                    3. 상기의 공사기간 중에라도 乙이 속한 공정이 종료되면 별도의 의사 표시 없이 재 계약은 종료된다.
                  </td>
                </tr>
                <tr>
                  <th style={{ verticalAlign: 'middle', padding: '3px 0' }}>
                    <div className="vertical-label" style={{ fontSize: '0.8rem', letterSpacing: '3px' }}>
                      <span>임</span>
                      <span style={{ fontSize: '0.3rem', opacity: 0 }}>&nbsp;</span>
                      <span>금</span>
                    </div>
                  </th>
                  <td style={{ padding: '0' }}>
                    <div style={{ padding: '1px 6px', borderBottom: '1px solid #000' }}>
                      1. 甲은 乙의 근로형태 등 업무의 특성을 고려하여 乙에게 불이익이 없는 범위에서 아래 "2"와 같이 포괄산정임금으로 산정된 일당 <strong>₩ {formatKRW(contract.dailyWage)}</strong> 을 출력일수에 따라 전산후 지급한다.
                    </div>
                    <div style={{ padding: '1px 6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
                        <tbody>
                          <tr style={{ fontSize: '0.62rem' }}>
                            <td style={{ border: 'none', width: '20px' }}>2.</td>
                            <td style={{ border: 'none', width: '90px' }}>① 기 &nbsp;&nbsp; 본 &nbsp;&nbsp; 급</td>
                            <td style={{ border: 'none', width: '80px' }}>1일 8시간</td>
                            <td style={{ border: 'none', width: '100px' }}>₩ {formatKRW(contract.wageBreakdown?.base)}</td>
                            <td style={{ border: 'none' }}>1일 총 환산근로시간 :</td>
                            <td style={{ border: 'none', textAlign: 'right', fontWeight: 'bold' }}>17.1 시간</td>
                          </tr>
                          <tr style={{ fontSize: '0.62rem' }}>
                            <td style={{ border: 'none' }}></td>
                            <td style={{ border: 'none' }}>② 유급주휴수당</td>
                            <td style={{ border: 'none' }}>1일 1.6시간</td>
                            <td style={{ border: 'none' }}>₩ {formatKRW(contract.wageBreakdown?.weekly)}</td>
                            <td style={{ border: 'none' }}>시 급 액 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ₩ 13,450</td>
                            <td style={{ border: 'none', textAlign: 'right' }}>일 급 액 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ₩ 107,602</td>
                          </tr>
                          <tr style={{ fontSize: '0.62rem' }}>
                            <td style={{ border: 'none' }}></td>
                            <td style={{ border: 'none' }}>③ 연장근로수당</td>
                            <td style={{ border: 'none' }}>1일 2시간</td>
                            <td style={{ border: 'none' }}>₩ {formatKRW(contract.wageBreakdown?.overtime)}</td>
                            <td style={{ border: 'none' }}></td>
                            <td style={{ border: 'none', textAlign: 'right', fontWeight: 'bold' }}>일 당 총 액 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ₩ {formatKRW(contract.dailyWage)}</td>
                          </tr>
                          <tr style={{ fontSize: '0.62rem' }}>
                            <td style={{ border: 'none' }}></td>
                            <td style={{ border: 'none' }}>④ 휴일근로수당</td>
                            <td style={{ border: 'none' }}>1일 3시간</td>
                            <td style={{ border: 'none' }}>₩ {formatKRW(contract.wageBreakdown?.holiday)}</td>
                            <td colSpan={2} style={{ border: 'none', textAlign: 'right', fontWeight: 'bold', color: '#d32f2f' }}>※ 공구대는 별도 10만원 지급한다.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ padding: '1px 6px', borderTop: '1px solid #000', fontSize: '0.62rem' }}>
                      3. 매월 급여 지급시 근로소득세 및 고용보험료, 의료보험료, 국민연금 등의 원천징수 대상이 된 경우 공제 후 지급한다. 급여는 乙의 온라인 계좌 입금을 원칙으로 한다.
                    </div>
                  </td>
                </tr>
                <tr>
                  <th style={{ verticalAlign: 'middle' }}>
                    <div className="vertical-label">
                      <span>근</span>
                      <span>로</span>
                      <span>시</span>
                      <span>간</span>
                    </div>
                  </th>
                  <td style={{ fontSize: '0.68rem' }}>
                    1. 시업 및 종업시간: 08:30 ~ 17:30 ( 8시간 ) <br/>
                    2. 근로시간은 휴게시간을 제외하고 1일 8시간 1주 40시간으로, 1주일에 12시간의 범위 내에서 甲의 지시에 의한 연장근로를 수행함에 동의한다.
                  </td>
                </tr>
                <tr>
                  <th style={{ verticalAlign: 'middle' }}>
                    <div className="vertical-label">
                      <span>휴</span>
                      <span>게</span>
                      <span>시</span>
                      <span>간</span>
                    </div>
                  </th>
                  <td style={{ fontSize: '0.68rem' }}>휴게시간 ( 12:00~13:00 ) 은 작업장 내에서 자유로이 사용할 수 있다.</td>
                </tr>
                <tr>
                  <th style={{ verticalAlign: 'middle' }}>
                    <div className="vertical-label">
                      <span>휴</span>
                      <span style={{ fontSize: '0.4rem', opacity: 0 }}>&nbsp;</span>
                      <span>가</span>
                    </div>
                  </th>
                  <td style={{ fontSize: '0.68rem' }}>
                    1. 생리휴가 : 여성근로자가 생리휴가를 청구하면 무급으로 부여 한다. <br/>
                    2. 연차휴가 : 근로기준법 기준에 따라 연차 휴가 발생시 유급으로 부여 한다. (법정공휴일은 연차휴가에 포함된다.)
                  </td>
                </tr>
                <tr>
                  <th style={{ verticalAlign: 'middle' }}>
                    <div className="vertical-label">
                      <span>휴</span>
                      <span style={{ fontSize: '0.4rem', opacity: 0 }}>&nbsp;</span>
                      <span>일</span>
                    </div>
                  </th>
                  <td style={{ fontSize: '0.68rem' }}>근로자의 날, 주휴일(소정 근로일 만근시), 토요일(무급휴일 )</td>
                </tr>
                <tr>
                  <th style={{ verticalAlign: 'middle' }}>
                    <div className="vertical-label" style={{ fontSize: '0.68rem', lineHeight: 1.1 }}>
                      <span>채</span>
                      <span>용</span>
                      <span>결</span>
                      <span>격</span>
                      <span>사</span>
                      <span>유</span>
                    </div>
                  </th>
                  <td style={{ fontSize: '0.68rem' }}>불법 체류자, 지명수배 중에 있는 자, 채용시 고혈압 및 척추질환 등 업무 수행에 곤란을 초래할 수 있는 자는 채용될 수 없으며, 위 사실이 추후 발견된 경우 본 근로계약은 취소 된다.</td>
                </tr>
                <tr>
                  <th style={{ verticalAlign: 'middle', padding: '6px 0' }}>
                    <div className="vertical-label" style={{ fontSize: '0.6rem', lineHeight: 1.1 }}>
                      <span>재</span>
                      <span>계</span>
                      <span>약</span>
                      <span style={{ margin: '1px 0' }}>거부</span>
                      <span style={{ margin: '1px 0' }}>사유</span>
                      <span>및</span>
                      <span style={{ margin: '1px 0' }}>운용</span>
                      <span style={{ margin: '1px 0' }}>기준</span>
                    </div>
                  </th>
                  <td style={{ fontSize: '0.64rem', padding: '2px 6px' }}>
                    1. 甲은 1일전에 통지로서 재 계약을 거부할 수 있다. <br/>
                    2. 안전수칙 불이행, 취업규칙 불이행으로 3회 이상 경고(구두경고 포함)처분 받은 경우 <br/>
                    3. 정당한 업무지시 불이행 및 고의 . 중대한 과실로 사고나 손실을 야기 시킨 경우 <br/>
                    4. 신체(고혈압, 디스크 포함) . 정신상 장애로 해당 업무를 수행할 수 없거나 질병 악화의 가능성이 있는 경우 <br/>
                    5. 甲의 동의 없이 타 작업장에 취업한 때 <br/>
                    6. 공정이 종료되었을 때 및 乙이 재 계약을 원하지 않을 때
                  </td>
                </tr>
                <tr>
                  <th style={{ verticalAlign: 'middle' }}>
                    <div className="vertical-label" style={{ fontSize: '0.65rem', lineHeight: 1.1 }}>
                      <span>기</span>
                      <span>타</span>
                      <span>근</span>
                      <span>로</span>
                      <span>조</span>
                      <span>건</span>
                    </div>
                  </th>
                  <td style={{ fontSize: '0.68rem' }}>
                    1. 본 계약서 상에 명시 되지 않은 사항은 근로기준법에 따른다. <br/>
                    2. 乙도 재 계약의 의사가 없는 경우에는 1일전에 통보하고 업무 인수인계 조치를 하여야 한다.
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 하단 날짜 및 서명 */}
            <div style={{ marginTop: '0', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px' }}>
                2026 &nbsp; 년 &nbsp;&nbsp;&nbsp; {cDate.month} &nbsp; 월 &nbsp;&nbsp;&nbsp; {cDate.date} &nbsp; 일
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 6px' }}>
                {/* 사용자 측 */}
                <div style={{ width: '45%', textAlign: 'left' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1px', fontSize: '0.75rem' }}>( 사 용 자 )</div>
                  <div style={{ fontSize: '0.68rem', lineHeight: '1.25' }}>
                    ◇ 사 업 장 명 : &nbsp;&nbsp;&nbsp; <strong>㈜ 아 델 라</strong> <br/>
                    ◇ 주 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 소 : &nbsp;&nbsp;&nbsp; 서울 강남구 학동로 11길 <br/>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 56 백송B/D 2층 <br/>
                    ◇ 대 표 전화번호 : &nbsp; 02-2281-0456
                  </div>
                </div>

                {/* 근로자 측 */}
                <div style={{ width: '45%', textAlign: 'left', position: 'relative' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '1px', fontSize: '0.75rem' }}>( 근 로 자 )</div>
                  <div style={{ fontSize: '0.68rem', lineHeight: '1.25' }}>
                    ◇ 성 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 명 : &nbsp;&nbsp;&nbsp; <strong>{contract.workerName}</strong> &nbsp; (인) <br/>
                    ◇ 주 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 소 : &nbsp;&nbsp;&nbsp; {contract.workerAddress} <br/>
                    ◇ 주민등록번호 : &nbsp;&nbsp; {contract.workerIdNum} <br/>
                    ◇ 휴 대 전 화 : &nbsp;&nbsp; {contract.workerPhone}
                  </div>
                  {contract.signatureUrl && (
                    <img src={contract.signatureUrl} alt="서명" style={{
                      position: 'absolute', right: '5px', bottom: '20px', width: '38px', height: '38px', objectFit: 'contain'
                    }} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 2페이지: 증빙 첨부 ─── */}
        {(contract.idCardUrl || contract.mealReceiptUrl) && (
          <div className="page-container" style={{ marginTop: '20px' }}>
            <div className="a4-page" style={styles.page}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2 style={{ border: '2px solid #000', padding: '5px 30px', display: 'inline-block', fontSize: '1.3rem' }}>첨 부 서 류 (증 빙)</h2>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                {contract.idCardUrl && (
                  <div className="attachment-box" style={{ border: '1px solid #000', padding: '10px' }}>
                    <p style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>[ 1. 신분증 사진 ]</p>
                    <div style={{ height: '110mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={contract.idCardUrl} alt="신분증" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                  </div>
                )}
                {contract.mealReceiptUrl && (
                  <div className="attachment-box" style={{ border: '1px solid #000', padding: '10px' }}>
                    <p style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>[ 2. 식대 영수증 ]</p>
                    <div style={{ height: '110mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={contract.mealReceiptUrl} alt="영수증" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    background: '#333', zIndex: 9999, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', alignItems: 'center'
  },
  controls: {
    position: 'sticky', top: 0, width: '100%',
    background: '#fff', padding: '12px 24px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)', zIndex: 10001
  },
  printBtn: {
    background: '#2e7d32', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold'
  },
  closeBtn: {
    background: '#f5f5f5', color: '#333', border: '1px solid #ccc', padding: '10px 20px', borderRadius: 6, cursor: 'pointer'
  },
  page: {
    background: '#fff', width: '210mm', minHeight: '296mm',
    padding: '3mm 6mm',
    boxShadow: '0 0 20px rgba(0,0,0,0.2)',
    boxSizing: 'border-box', color: '#000', fontFamily: "'Pretendard', 'Malgun Gothic', sans-serif"
  }
};

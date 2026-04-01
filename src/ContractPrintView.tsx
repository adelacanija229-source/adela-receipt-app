import React from 'react';

// 계약서 데이터 인터페이스 (App.tsx와 공유하거나 임시 선언)
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
  status: string;
  createdAt: any;
}

export const ContractPrintView = ({ contract, onClose }: { contract: Contract; onClose: () => void }) => {

  const formatKRW = (n: number) => n.toLocaleString('ko-KR');

  // 생성일(또는 시작일)을 "20XX년 XX월 XX일" 포맷으로 분리
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

  return (
    <div style={styles.overlay}>
      {/* 화면단 상단 컨트롤 (프린트시에는 숨겨짐) */}
      <div className="print-controls" style={styles.controls}>
        <span style={{ fontWeight: 700 }}>출력 모드</span>
        <div>
          <button onClick={() => window.print()} style={styles.printBtn}>🖨️ 인쇄 / PDF 저장</button>
          <button onClick={onClose} style={styles.closeBtn}>닫기</button>
        </div>
      </div>

      {/* A4 인쇄 영역 */}
      <div className="a4-page" style={styles.page}>
        
        {/* 상단 타이틀 */}
        <div style={styles.titleContainer}>
          <h1 style={styles.mainTitle}>일 용 근 로 계 약 서 (40h)</h1>
        </div>

        {/* 상단 표 (인적사항) */}
        <table style={styles.table}>
          <tbody>
            <tr>
              <td rowSpan={2} style={{ ...styles.td, ...styles.th, width: '12%' }}>( 甲 ) 사 용 자</td>
              <td style={{ ...styles.td, width: '15%', textAlign: 'center' }}>상 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 호</td>
              <td colSpan={3} style={{ ...styles.td, textAlign: 'center' }}>㈜ 아 델 라</td>
              <td style={{ ...styles.td, width: '15%', textAlign: 'center' }}>현장소장</td>
              <td style={{ ...styles.td, width: '20%', textAlign: 'center' }}>{contract.managerName}</td>
            </tr>
            <tr>
              <td style={{ ...styles.td, textAlign: 'center' }}>주 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 소</td>
              <td colSpan={3} style={{ ...styles.td, textAlign: 'center' }}>서울 강남구 학동로 11길 56 백송B/D 2층</td>
              <td style={{ ...styles.td, textAlign: 'center' }}>전 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 화</td>
              <td style={{ ...styles.td, textAlign: 'center' }}>02-2281-0456</td>
            </tr>
            <tr>
              <td rowSpan={3} style={{ ...styles.td, ...styles.th }}>( 乙 ) 근 로 자</td>
              <td style={{ ...styles.td, textAlign: 'center' }}>성 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 명</td>
              <td colSpan={3} style={{ ...styles.td, textAlign: 'center' }}>{contract.workerName}</td>
              <td style={{ ...styles.td, textAlign: 'center' }}>주민등록번호</td>
              <td style={{ ...styles.td, textAlign: 'center' }}>{contract.workerIdNum}</td>
            </tr>
            <tr>
              <td style={{ ...styles.td, textAlign: 'center' }}>주 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 소</td>
              <td colSpan={3} style={{ ...styles.td, textAlign: 'center' }}>{contract.workerAddress}</td>
              <td style={{ ...styles.td, textAlign: 'center' }}>핸드폰 번호</td>
              <td style={{ ...styles.td, textAlign: 'center' }}>{contract.workerPhone}</td>
            </tr>
            <tr>
              <td style={{ ...styles.td, textAlign: 'center' }}>계 좌 번 호</td>
              <td style={{ ...styles.td, textAlign: 'center', width: '25%' }}>{contract.bankAccount}</td>
              <td style={{ ...styles.td, textAlign: 'center', width: '20%', borderRight: 'none' }}>은행 : {contract.bankName}</td>
              <td colSpan={2} style={{ ...styles.td, textAlign: 'right', borderLeft: 'none' }}>예금주 : {contract.bankHolder}</td>
            </tr>
          </tbody>
        </table>

        {/* 선언 문구 */}
        <div style={styles.declaration}>
          <strong>아래의 근로 조건을 성실히 이행할 것을 약정하고 근로계약을 체결한다.</strong><br/>
          <span style={{ letterSpacing: '2em', marginLeft: '1em' }}>― 아 래 ―</span>
        </div>

        {/* 메인 약관 표 */}
        <table style={{ ...styles.table, borderTop: '2px solid black' }}>
          <tbody>
            <tr>
              <td style={{ ...styles.td, ...styles.th, width: '12%' }}>근 로 장 소</td>
              <td style={styles.td}>각 현 장 ( 현장명 : <strong>{contract.siteName}</strong> )</td>
            </tr>
            <tr>
              <td style={{ ...styles.td, ...styles.th }}>계 약 기 간</td>
              <td style={{ ...styles.td, lineHeight: 1.3 }}>
                공사 예정기간 : <strong>{contract.startDate.replace(/-/g, ' . ')}</strong> ~ <strong>{contract.endDate.replace(/-/g, ' . ')}</strong> &nbsp;&nbsp;&nbsp;&nbsp; ( 개월 ) <br/>
                1. 甲과 乙의 근로 계약 관계는 1일 단위로 근로관계가 생성되는 일용직 근로계약 관계이나, 실무적 편의를<br/>
                <span style={{ display: 'inline-block', paddingLeft: 12 }}>위해 근로조건의 변함이 없고 甲과 乙 간에 이의가 없다면 별도의 계약 절차 없이 동일한 계약이 갱신된</span><br/>
                <span style={{ display: 'inline-block', paddingLeft: 12 }}>것으로 본다.</span><br/>
                2. 甲과 乙은 당해 공사 기간 중 이라도 1일 전에 일방이 재 계약을 거부할 수 있다.<br/>
                3. 상기의 공사기간 중에라도 乙이 속한 공정이 종료되면 별도의 의사 표시 없이 재 계약은 종료된다.
              </td>
            </tr>
            <tr>
              <td style={{ ...styles.td, ...styles.th }}>임 금</td>
              <td style={{ ...styles.td, padding: 0 }}>
                <div style={{ padding: '2px 4px', borderBottom: '1px solid black', lineHeight: 1.3 }}>
                  1. 甲은 乙의 근로형태 등 업무의 특성을 고려하여 乙에게 불이익이 없는 범위에서 아래 "2"와 같이 포괄<br/>
                  <span style={{ display: 'inline-block', paddingLeft: 12 }}>산정임금으로 산정된 일당 <strong>₩ {formatKRW(contract.dailyWage)}</strong> 을 출력일수에 따라 매월1일~말일까지 정산후 익월 10일 에 지급한다.</span>
                </div>
                
                {/* 임금 내역 중첩 표 (테두리 없음) */}
                <div style={{ padding: '2px 4px', fontSize: '0.75rem', borderBottom: '1px solid black' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', lineHeight: 1.4 }}>
                    <tbody>
                      <tr>
                        <td style={{ width: 14, verticalAlign: 'top', border: 'none', padding: 0 }}>2.</td>
                        <td style={{ width: 90, border: 'none', padding: 0 }}>① 기 &nbsp;&nbsp;&nbsp;본 &nbsp;&nbsp;&nbsp;급</td>
                        <td style={{ width: 70, border: 'none', padding: 0 }}>1일 8시간</td>
                        <td style={{ width: 80, border: 'none', padding: 0 }}>₩ {formatKRW(contract.wageBreakdown?.base || 0)}</td>
                        <td style={{ width: 140, paddingLeft: 30, border: 'none', padding: 0 }}>1일 총 환산근로시간 :</td>
                        <td style={{ border: 'none', padding: 0, textAlign: 'right' }}>17.1 시간 </td>
                      </tr>
                      <tr>
                        <td style={{ border: 'none', padding: 0 }}></td>
                        <td style={{ border: 'none', padding: 0 }}>② 유급주휴수당</td>
                        <td style={{ border: 'none', padding: 0 }}>1일 1.6시간</td>
                        <td style={{ border: 'none', padding: 0 }}>₩ &nbsp;{formatKRW(contract.wageBreakdown?.weekly || 0)}</td>
                        <td style={{ paddingLeft: 30, border: 'none', padding: 0 }}>시 급 액 : &nbsp;&nbsp;&nbsp; ₩ 13,450</td>
                        <td style={{ border: 'none', padding: 0, textAlign: 'right' }}>일 급 액 : &nbsp;&nbsp;&nbsp; ₩ 107,602</td>
                      </tr>
                      <tr>
                        <td style={{ border: 'none', padding: 0 }}></td>
                        <td style={{ border: 'none', padding: 0 }}>③ 연장근로수당</td>
                        <td style={{ border: 'none', padding: 0 }}>1일 2시간</td>
                        <td style={{ border: 'none', padding: 0 }}>₩ &nbsp;{formatKRW(contract.wageBreakdown?.overtime || 0)}</td>
                        <td style={{ paddingLeft: 30, border: 'none', padding: 0, textAlign: 'right' }}>일 당 총 액 :</td>
                        <td style={{ border: 'none', padding: 0, textAlign: 'right' }}>₩ {formatKRW(contract.dailyWage)}</td>
                      </tr>
                      <tr>
                        <td style={{ border: 'none', padding: 0 }}></td>
                        <td style={{ border: 'none', padding: 0 }}>④ 휴일근로수당</td>
                        <td style={{ border: 'none', padding: 0 }}>1일 3시간</td>
                        <td style={{ border: 'none', padding: 0 }}>₩ &nbsp;{formatKRW(contract.wageBreakdown?.holiday || 0)}</td>
                        <td colSpan={2} style={{ border: 'none', padding: 0, textAlign: 'center', color: '#cc0000' }}>
                          {['목공', '타일', '설비'].includes(contract.workType) ? '※ 공구대는 별도 10만원 지급한다.' : ''}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ padding: '2px 4px', lineHeight: 1.3 }}>
                  3. 매월 급여 지급시 근로소득세 및 고용보험료, 의료보험료, 국민연금 등의 원천징수 대상이 된 경우 공제 후<br/>
                  <span style={{ display: 'inline-block', paddingLeft: 12 }}>지급한다. 급여는 乙의 온라인 계좌 입금을 원칙으로 한다.</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ ...styles.td, ...styles.th }}>근 로 시 간</td>
              <td style={{ ...styles.td, lineHeight: 1.3 }}>
                1. 시업 및 종업시간: 08:30 ~ 17:30 ( 8시간 )<br/>
                2. 근로시간은 휴게시간을 제외하고 1일 8시간 1주 40시간으로, 1주일에 12시간의 범위 내에서 甲의 지시에<br/>
                <span style={{ display: 'inline-block', paddingLeft: 12 }}>의한 연장근로를 수행함에 동의한다.</span>
              </td>
            </tr>
            <tr>
              <td style={{ ...styles.td, ...styles.th }}>휴 게 시 간</td>
              <td style={styles.td}>휴게시간 ( 12:00-13:00 ) 은 작업장 내에서 자유로이 사용할 수 있다.</td>
            </tr>
            <tr>
              <td style={{ ...styles.td, ...styles.th }}>휴 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 가</td>
              <td style={{ ...styles.td, lineHeight: 1.3 }}>
                1. 생리휴가 : 여성근로자가 생리휴가를 청구하면 무급으로 부여 한다.<br/>
                2. 연차휴가 : 근로기준법 기준에 따라 연차 휴가 발생시 유급으로 부여 한다. (법정공휴일은 연차휴가에 포함된다.)
              </td>
            </tr>
            <tr>
              <td style={{ ...styles.td, ...styles.th }}>휴 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 일</td>
              <td style={styles.td}>근로자의 날, 주휴일(소정 근로일 만근시), 토요일( 무급휴일 )</td>
            </tr>
            <tr>
              <td style={{ ...styles.td, ...styles.th, letterSpacing: '-1px' }}>채용결격<br/>사 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 유</td>
              <td style={{ ...styles.td, lineHeight: 1.3 }}>
                불법 체류자, 지명수배 중에 있는 자, 채용시 고혈압 및 척추질환 등 업무 수행에 곤란을 초래할 수 있는 자는<br/>
                채용될 수 없으며, 위 사실이 추후 발견된 경우 본 근로계약은 취소 된다.
              </td>
            </tr>
            <tr>
              <td style={{ ...styles.td, ...styles.th, letterSpacing: '-1px' }}>재계약<br/>거부사유<br/>및<br/>운용기준</td>
              <td style={{ ...styles.td, lineHeight: 1.3 }}>
                1. 甲은 1일전에 통지로서 재 계약을 거부할 수 있다.<br/>
                2. 안전수칙 불이행, 취업규칙 불이행으로 3회 이상 경고(구두경고 포함)처분 받은 경우<br/>
                3. 정당한 업무지시 불이행 및 고의 . 중대한 과실로 사고나 손실을 야기 시킨 경우<br/>
                4. 신체(고혈압, 디스크 포함) . 정신상 장애로 해당 업무를 수행할 수 없거나 질병 악화의 가능성이 있는 경우<br/>
                5. 甲의 동의 없이 타 작업장에 취업한 때<br/>
                6. 공정이 종료되었을 때 및 乙이 재 계약을 원하지 않을 때
              </td>
            </tr>
            <tr>
              <td style={{ ...styles.td, ...styles.th, letterSpacing: '-1px' }}>기타근로<br/>조 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 건</td>
              <td style={{ ...styles.td, lineHeight: 1.3 }}>
                1. 본 계약서 상에 명시 되지 않은 사항은 근로기준법에 따른다.<br/>
                2. 乙도 재 계약의 의사가 없는 경우에는 1일전에 통보하고 업무 인수인계 조치를 하여야 한다.
              </td>
            </tr>
          </tbody>
        </table>

        {/* 하단 서명란 */}
        <div style={styles.footerWrap}>
          <div style={styles.footerDate}>
            <strong>{cDate.year}</strong> &nbsp; 년 &nbsp;&nbsp;&nbsp; <strong>{cDate.month}</strong> &nbsp; 월 &nbsp;&nbsp;&nbsp; <strong>{cDate.date}</strong> &nbsp; 일
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', fontSize: '0.8rem', lineHeight: 1.35 }}>
            
            {/* 좌측: 사용자 */}
            <div style={{ flex: 1 }}>
              <strong>( 사 용 자 )</strong><br/>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: 4 }}>
                <span style={{ width: 100 }}>◇ 사 업 장 명 : </span>
                <strong style={{ fontSize: '0.9rem' }}>㈜ 아 델 라</strong>
              </div>
              <div style={{ display: 'flex', marginTop: 4 }}>
                <span style={{ width: 100, flexShrink: 0 }}>◇ 주 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 소 : </span>
                <span>서울 강남구 학동로 11길 56 백송B/D 2층</span>
              </div>
              <div style={{ display: 'flex', marginTop: 4 }}>
                <span style={{ width: 100 }}>◇ 대표 전화번호: </span>
                <span>02-2281-0456</span>
              </div>
            </div>

            {/* 우측: 근로자 */}
            <div style={{ flex: 1.2, paddingLeft: 40 }}>
              <strong>( 근 로 자 )</strong><br/>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: 4 }}>
                <span style={{ width: 100 }}>◇ 성 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 명 : </span>
                <strong style={{ fontSize: '0.9rem', flex: 1, textAlign: 'center' }}>{contract.workerName}</strong>
                <span style={{ marginLeft: 'auto', marginRight: 40 }}>(인)</span>
                
                {/* 근로자 서명 이미지 렌더링 - (인) 글씨 위에 겹쳐서 표시 */}
                {contract.signatureUrl && (
                  <img src={contract.signatureUrl} alt="서명" style={{
                    position: 'absolute', right: 20, top: -15, width: 60, height: 60, objectFit: 'contain'
                  }} />
                )}
              </div>
              <div style={{ display: 'flex', marginTop: 4 }}>
                <span style={{ width: 100, flexShrink: 0 }}>◇ 주 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 소 : </span>
                <span>{contract.workerAddress}</span>
              </div>
              <div style={{ display: 'flex', marginTop: 4 }}>
                <span style={{ width: 100 }}>◇ 주민등록번호 : </span>
                <span>{contract.workerIdNum}</span>
              </div>
              <div style={{ display: 'flex', marginTop: 4 }}>
                <span style={{ width: 100 }}>◇ 휴 대 전 화 : </span>
                <span>{contract.workerPhone}</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 인쇄 화면 전용 스타일 ───────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
    background: '#525659', zIndex: 9999, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0'
  },
  controls: {
    background: '#fff', padding: '12px 24px', borderRadius: 8,
    display: 'flex', gap: 24, alignItems: 'center', marginBottom: 20,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  },
  printBtn: {
    background: '#2b5797', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 700, marginRight: 8
  },
  closeBtn: {
    background: '#e0e0e0', color: '#333', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 600
  },
  page: {
    background: '#fff', width: '210mm', height: '297mm', // A4 크기 지정 (minHeight 대신 고정 height로 오버플로우 강제 억제 효과 기대하지만 내부 컨텐츠가 늘어나면 늘어남)
    padding: '8mm 12mm', // 상하좌우 여백 (압축)
    boxSizing: 'border-box', color: '#000', fontFamily: "'Pretendard', 'Malgun Gothic', 'Dotum', sans-serif"
  },
  titleContainer: {
    textAlign: 'center' as const, marginBottom: 8,
  },
  mainTitle: {
    display: 'inline-block', border: '2px solid black',
    background: '#e6f0fa', // 연한 파란색 배경
    padding: '4px 30px', margin: 0, fontSize: '1.3rem', letterSpacing: '6px', fontWeight: 900
  },
  table: {
    width: '100%', borderCollapse: 'collapse', border: '2px solid black', marginBottom: 6,
    fontSize: '0.75rem'
  },
  td: {
    border: '1px solid black', padding: '2px 4px', verticalAlign: 'middle', wordBreak: 'keep-all'
  },
  th: {
    fontWeight: 700, textAlign: 'center', letterSpacing: '4px'
  },
  declaration: {
    textAlign: 'center', padding: '4px 0', fontSize: '0.85rem', borderLeft: '2px solid black', borderRight: '2px solid black'
  },
  footerWrap: {
    marginTop: 6, padding: '4px 0'
  },
  footerDate: {
    textAlign: 'center', marginBottom: 8, fontSize: '0.9rem'
  }
};

import React, { useState, useRef, useEffect } from 'react';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

// Firebase SDK 싱글톤 - App.tsx에서 이미 초기화된 앱 재사용
const db = getFirestore();
const storage = getStorage();

// ─── 상수 ──────────────────────────────────────────────────────────
const WORK_TYPES = ['목공', '도배', '타일', '페인트', '철근', '전기', '설비', '미장', '조적', '유리', '기타'];

const MANAGERS: Record<string, string[]> = {
  '공무팀': ['배병선', '권재현', '양승곤', '김성진', '김현석', '권오경', '권순범', '윤재호'],
  '디자인 팀': ['김대교', '임효정', '이선민', '정예슬', '김소현', '최정은', '윤혜린', '김지연', '한아영', '김지은'],
  '설계팀': ['김승현'],
};

// ─── 임금 자동 계산 (실제 양식 기준: 일당 230,000원 비율) ──────────────
function calcWage(total: number) {
  const base     = Math.round(total * (107602 / 230000)); // 기본급 (1일 8시간)
  const overtime = Math.round(total * (40351  / 230000)); // 연장근로수당 (1일 2시간)
  const holiday  = Math.round(total * (60526  / 230000)); // 휴일근로수당 (1일 3시간)
  const weekly   = total - base - overtime - holiday;      // 유급주휴수당 (나머지)
  return { base, overtime, holiday, weekly };
}

function formatKRW(n: number) {
  return n.toLocaleString('ko-KR');
}

// ═══════════════════════════════════════════════════════════════════
// 서명 패드 컴포넌트
// ═══════════════════════════════════════════════════════════════════
const SignaturePad = ({ onSave, onBack }: { onSave: (blob: Blob) => void; onBack: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    const pos    = getPos(e, canvas);
    isDrawing.current = true;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    const pos    = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const endDraw = () => { isDrawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const save = () => {
    const canvas = canvasRef.current!;
    canvas.toBlob(blob => { if (blob) onSave(blob); }, 'image/png');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fcfcfc', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#333' }}>✕</button>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>근로자 서명</span>
        <button onClick={clear} style={{ background: 'none', border: '1px solid #eee', borderRadius: 20, padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer', color: '#666' }}>
          지우기
        </button>
      </div>

      <div style={{ padding: '20px 20px 12px', color: '#888', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.6 }}>
        아래 서명란에 근로자가 직접 손가락으로 서명해 주세요
      </div>

      <div style={{ margin: '0 20px', flex: 1, maxHeight: 280 }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%', height: 260, background: '#fff',
            border: '2px solid #1a1a1a', borderRadius: 16,
            display: 'block', touchAction: 'none',
          }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
      </div>

      <div style={{ padding: '20px' }}>
        <button
          onClick={save}
          disabled={isEmpty}
          style={{
            width: '100%', padding: 18, background: isEmpty ? '#ddd' : '#9c2c2c',
            color: 'white', border: 'none', borderRadius: 18, fontSize: '1.1rem',
            fontWeight: 700, cursor: isEmpty ? 'not-allowed' : 'pointer',
          }}
        >
          서명 완료 → 계약서 제출
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// 계약서 작성 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════════
export const ContractApp = () => {
  type View = 'form' | 'signature' | 'submitting' | 'done';
  const [view, setView] = useState<View>('form');
  const [showPicker, setShowPicker] = useState(false);

  // ── 입력 필드 ────────────────────────────────────────────────────
  const [workerName,    setWorkerName]    = useState('');
  const [workerIdNum,   setWorkerIdNum]   = useState(''); // 주민등록번호
  const [workerPhone,   setWorkerPhone]   = useState('');
  const [workerAddress, setWorkerAddress] = useState('');
  const [bankName,      setBankName]      = useState(''); // 은행
  const [bankAccount,   setBankAccount]   = useState(''); // 계좌번호
  const [bankHolder,    setBankHolder]    = useState(''); // 예금주
  const [siteName,      setSiteName]      = useState('');
  const [workType,      setWorkType]      = useState('');
  const [startDate,     setStartDate]     = useState('');
  const [endDate,       setEndDate]       = useState('');
  const [dailyWage,     setDailyWage]     = useState('');
  const [managerName,   setManagerName]   = useState('');

  const wageNum = Number(dailyWage.replace(/,/g, ''));
  const wage    = wageNum > 0 ? calcWage(wageNum) : null;

  const canProceed = !!(workerName && siteName && workType && startDate && endDate && dailyWage && managerName);

  // ── 서명 완료 후 파이어베이스 저장 ──────────────────────────────────
  const handleSignatureSave = async (blob: Blob) => {
    setView('submitting');
    try {
      // 1. 서명 이미지 → contract_signatures/ 폴더에 업로드
      const sigPath = `contract_signatures/${Date.now()}_${workerName}.png`;
      const sigRef  = storageRef(storage, sigPath);
      await uploadBytes(sigRef, blob);
      const signatureUrl = await getDownloadURL(sigRef);

      // 2. Firestore contracts 컬렉션에 저장
      await addDoc(collection(db, 'contracts'), {
        workerName:      workerName.trim(),
        workerIdNum:     workerIdNum.trim(),
        workerPhone:     workerPhone.trim(),
        workerAddress:   workerAddress.trim(),
        bankName:        bankName.trim(),
        bankAccount:     bankAccount.trim(),
        bankHolder:      bankHolder.trim(),
        siteName:        siteName.trim(),
        workType,
        startDate,
        endDate,
        dailyWage:       wageNum,
        wageBreakdown:   wage,
        managerName,
        signatureUrl,
        linkedReceiptIds: [],   // 나중에 관리자가 영수증 연결
        status:          'signed',
        createdAt:       serverTimestamp(),
      });

      setView('done');
    } catch (err) {
      console.error(err);
      setView('form');
      alert('제출에 실패했습니다. 인터넷 연결을 확인 후 다시 시도해 주세요.');
    }
  };

  const reset = () => {
    setWorkerName(''); setWorkerIdNum(''); setWorkerPhone(''); setWorkerAddress('');
    setBankName(''); setBankAccount(''); setBankHolder('');
    setSiteName(''); setWorkType(''); setStartDate(''); setEndDate('');
    setDailyWage(''); setManagerName('');
    setView('form');
  };

  // ── 서명 화면 ─────────────────────────────────────────────────────
  if (view === 'signature') {
    return <SignaturePad onSave={handleSignatureSave} onBack={() => setView('form')} />;
  }

  // ── 업로드 중 ─────────────────────────────────────────────────────
  if (view === 'submitting') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 20, fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '4px solid #f0f0f0', borderTopColor: '#9c2c2c', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: '1rem', fontWeight: 600, color: '#333' }}>계약서 저장 중...</p>
      </div>
    );
  }

  // ── 완료 화면 ─────────────────────────────────────────────────────
  if (view === 'done') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 24, padding: '0 24px', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#9c2c2c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>계약서 제출 완료</p>
          <p style={{ color: '#888', marginTop: 12, lineHeight: 1.7, fontSize: '0.95rem' }}>
            <strong style={{ color: '#333' }}>{workerName}</strong> 근로자<br />
            서명이 완료되었습니다.
          </p>
        </div>
        <button onClick={reset}
          style={{ padding: '16px 40px', borderRadius: 18, background: '#9c2c2c', color: 'white', border: 'none', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(156,44,44,0.2)' }}>
          새 계약서 작성
        </button>
        <button onClick={() => window.location.href = '/'}
          style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.9rem' }}>
          홈으로
        </button>
      </div>
    );
  }

  // ── 계약서 작성 폼 ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#fcfcfc', color: '#1a1a1a', display: 'flex', flexDirection: 'column', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #f0f0f0', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => window.location.href = '/'} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#555' }}>✕</button>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>일용근로계약서</span>
        <div style={{ width: 32 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>

        {/* 작업 유형 */}
        <div style={CS.section}>
          <p style={CS.sectionTitle}>작업 유형</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {WORK_TYPES.map(t => (
              <div key={t} onClick={() => setWorkType(t)} style={{
                padding: '10px 16px', borderRadius: 40, fontSize: '0.9rem', cursor: 'pointer',
                background: workType === t ? '#9c2c2c10' : '#f5f5f5',
                border:     workType === t ? '1px solid #9c2c2c' : '1px solid #efefef',
                color:      workType === t ? '#9c2c2c' : '#666',
                fontWeight: workType === t ? 700 : 400,
              }}>
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* 근로자 정보 */}
        <div style={CS.section}>
          <p style={CS.sectionTitle}>근로자 정보</p>
          <label style={CS.label}>성명 <span style={{ color: '#9c2c2c' }}>*</span></label>
          <input style={CS.input} placeholder="홍길동" value={workerName} onChange={e => setWorkerName(e.target.value)} />

          <label style={{ ...CS.label, marginTop: 14 }}>주민등록번호</label>
          <input style={CS.input} placeholder="000000-0000000" value={workerIdNum}
            onChange={e => setWorkerIdNum(e.target.value)} />

          <label style={{ ...CS.label, marginTop: 14 }}>연락처 (랜드폰)</label>
          <input style={CS.input} placeholder="010-0000-0000" type="tel"
            value={workerPhone} onChange={e => setWorkerPhone(e.target.value)} />

          <label style={{ ...CS.label, marginTop: 14 }}>주소</label>
          <input style={CS.input} placeholder="경기도 김포시..."
            value={workerAddress} onChange={e => setWorkerAddress(e.target.value)} />

          <label style={{ ...CS.label, marginTop: 14 }}>계좌번호</label>
          <input style={CS.input} placeholder="1002-931-178605" value={bankAccount}
            onChange={e => setBankAccount(e.target.value)} />

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={CS.label}>은행</label>
              <input style={CS.input} placeholder="우리" value={bankName}
                onChange={e => setBankName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={CS.label}>예금주</label>
              <input style={CS.input} placeholder="홍길동" value={bankHolder}
                onChange={e => setBankHolder(e.target.value)} />
            </div>
          </div>
        </div>

        {/* 현장 정보 */}
        <div style={CS.section}>
          <p style={CS.sectionTitle}>현장 정보</p>
          <label style={CS.label}>현장명 <span style={{ color: '#9c2c2c' }}>*</span></label>
          <input style={CS.input} placeholder="압구정 현장"
            value={siteName} onChange={e => setSiteName(e.target.value)} />
        </div>

        {/* 근로 기간 */}
        <div style={CS.section}>
          <p style={CS.sectionTitle}>근로 기간</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={CS.label}>시작일 <span style={{ color: '#9c2c2c' }}>*</span></label>
              <input style={CS.input} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={CS.label}>종료일 <span style={{ color: '#9c2c2c' }}>*</span></label>
              <input style={CS.input} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* 임금 */}
        <div style={CS.section}>
          <p style={CS.sectionTitle}>임금 (일당 기준)</p>
          <label style={CS.label}>일당 총액 <span style={{ color: '#9c2c2c' }}>*</span></label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...CS.input, paddingRight: 36 }}
              placeholder="230,000"
              value={dailyWage}
              inputMode="numeric"
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setDailyWage(raw ? Number(raw).toLocaleString('ko-KR') : '');
              }}
            />
            {dailyWage && <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: '#999', fontSize: '0.9rem' }}>원</span>}
          </div>

          {/* 자동 계산 결과표 */}
          {wage && (
            <div style={{ marginTop: 14, background: '#f9f9f9', borderRadius: 14, padding: '14px 16px', border: '1px solid #f0f0f0' }}>
              <p style={{ fontSize: '0.73rem', color: '#9c2c2c', fontWeight: 700, marginBottom: 10, letterSpacing: '0.05em' }}>자동 계산 내역 (주 40시간 기준)</p>
              {([
                ['기본급 (1일 8시간)',   wage.base],
                ['연장근로수당 (1일 2시간)', wage.overtime],
                ['휴일근로수당 (1일 3시간)', wage.holiday],
                ['유급주휴수당',         wage.weekly],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '5px 0', borderBottom: '1px solid #efefef' }}>
                  <span style={{ color: '#666' }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{formatKRW(val)}원</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '8px 0 2px', fontWeight: 700 }}>
                <span>합계</span>
                <span style={{ color: '#9c2c2c' }}>{formatKRW(wageNum)}원</span>
              </div>
            </div>
          )}
        </div>

        {/* 담당 소장 */}
        <div style={CS.section}>
          <p style={CS.sectionTitle}>작성자 (소장)</p>
          <label style={CS.label}>소장 이름 <span style={{ color: '#9c2c2c' }}>*</span></label>
          <div onClick={() => setShowPicker(true)} style={{
            ...CS.input, display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', cursor: 'pointer',
          }}>
            <span style={{ color: managerName ? '#1a1a1a' : '#aaa' }}>{managerName || '담당자 선택'}</span>
            <span style={{ fontSize: '0.8rem', color: '#555' }}>▼</span>
          </div>
        </div>
      </div>

      {/* 담당자 선택 모달 */}
      {showPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}
          onClick={() => setShowPicker(false)}>
          <div style={{ background: '#fff', borderRadius: '32px 32px 0 0', padding: '28px 20px 56px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 20 }}>담당자 선택</p>
            {Object.entries(MANAGERS).map(([team, members]) => (
              <div key={team} style={{ marginBottom: 24 }}>
                <p style={{ fontSize: '0.85rem', color: '#9c2c2c', fontWeight: 700, marginBottom: 12 }}>{team}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {members.map(m => (
                    <button key={m} onClick={() => { setManagerName(m); setShowPicker(false); }} style={{
                      padding: '12px 18px', borderRadius: 12,
                      background: managerName === m ? '#9c2c2c' : '#fff',
                      border:     managerName === m ? '1px solid #9c2c2c' : '1px solid #eee',
                      color:      managerName === m ? 'white' : '#555',
                      fontSize: '0.9rem', fontWeight: managerName === m ? 700 : 400,
                    }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 하단 제출 버튼 */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: '#fcfcfc', borderTop: '1px solid #f0f0f0' }}>
        <button
          onClick={() => setView('signature')}
          disabled={!canProceed}
          style={{
            width: '100%', padding: 18, borderRadius: 18,
            background: canProceed ? '#9c2c2c' : '#ddd',
            color: 'white', border: 'none', fontSize: '1.1rem', fontWeight: 700,
            cursor: canProceed ? 'pointer' : 'not-allowed',
            boxShadow: canProceed ? '0 8px 24px rgba(156,44,44,0.2)' : 'none',
          }}>
          근로자 서명 받기 →
        </button>
      </div>
    </div>
  );
};

// ─── ContractApp 스타일 ────────────────────────────────────────────
const CS: Record<string, React.CSSProperties> = {
  section:      { padding: '24px 20px 0' },
  sectionTitle: { fontSize: '0.75rem', color: '#9c2c2c', fontWeight: 700, marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' as 'uppercase' },
  label:        { display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: 8, fontWeight: 600 },
  input:        { width: '100%', padding: '16px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 16, color: '#1a1a1a', fontSize: '1rem', fontFamily: 'inherit', boxSizing: 'border-box' as 'border-box' },
};

export default ContractApp;

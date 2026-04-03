import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './App';

// ─── 상수 ──────────────────────────────────────────────────────────
const WORK_TYPES = ['목공', '타일', '도배', '전기', '필름', '기타'];

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

// ── 이미지 압축 유틸리티 ───────────────────────────────────────────
const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.7);
      };
    };
  });
};

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
        <button onClick={onBack} style={{ background: '#f5f5f5', border: 'none', width: 36, height: 36, borderRadius: 18, fontSize: '1rem', cursor: 'pointer', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: '0.95rem', display: 'block' }}>근로자 서명</span>
          <span style={{ fontSize: '0.65rem', color: '#999', letterSpacing: '0.05em' }}>WORKER SIGNATURE</span>
        </div>
        <button onClick={clear} style={{ background: 'none', border: '1px solid #eee', borderRadius: 20, padding: '6px 14px', fontSize: '0.75rem', cursor: 'pointer', color: '#888', fontWeight: 600 }}>
          지우기
        </button>
      </div>

      <div style={{ padding: '32px 24px 16px', color: '#555', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.6 }}>
        <strong style={{ color: '#1a1a1a' }}>아래 흰색 영역</strong>에 직접 서명해 주세요.<br />
        <span style={{ color: '#aaa', fontSize: '0.75rem' }}>※ 서명은 계약서 하단에 자동으로 기록됩니다.</span>
      </div>

      <div style={{ margin: '0 20px', flex: 1, maxHeight: 300, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%', height: 280, background: '#fff',
            border: '2px solid #1a1a1a', borderRadius: 24,
            display: 'block', touchAction: 'none',
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
          }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
        {isEmpty && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', color: '#eee', fontSize: '3rem', fontWeight: 900, opacity: 0.5, letterSpacing: '0.2em' }}>SIGN HERE</div>
        )}
      </div>

      <div style={{ padding: '24px' }}>
        <button
          onClick={save}
          disabled={isEmpty}
          style={{
            width: '100%', padding: 20, background: isEmpty ? '#eee' : '#1a1a1a',
            color: isEmpty ? '#aaa' : 'white', border: 'none', borderRadius: 20, fontSize: '1.1rem',
            fontWeight: 800, cursor: isEmpty ? 'not-allowed' : 'pointer',
            boxShadow: isEmpty ? 'none' : '0 12px 30px rgba(0,0,0,0.15)',
            transition: 'all 0.2s'
          }}
        >
          {isEmpty ? '서명을 진행해 주세요' : '서명 완료 및 계약서 제출'}
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
  const [step, setStep] = useState(1); // 1: 인적사항, 2: 근로여건, 3: 서류첨부, 4: 서명 안내/미리보기
  const [showPicker, setShowPicker] = useState(false);

  // ── 입력 필드 ────────────────────────────────────────────────────
  const [workerName,    setWorkerName]    = useState('');
  const [workerIdNum,   setWorkerIdNum]   = useState(''); 
  const [workerPhone,   setWorkerPhone]   = useState('');
  const [workerAddress, setWorkerAddress] = useState('');
  const [bankName,      setBankName]      = useState(''); 
  const [bankAccount,   setBankAccount]   = useState(''); 
  const [bankHolder,    setBankHolder]    = useState(''); 
  const [siteName,      setSiteName]      = useState('');
  const [workType,      setWorkType]      = useState('');
  const [startDate,     setStartDate]     = useState('');
  const [endDate,       setEndDate]       = useState('');
  const [dailyWage,     setDailyWage]     = useState('');
  const [managerName,   setManagerName]   = useState('');
  
  // ── 직접 입력 및 증빙 서류 ───────────────────────────────────────
  const [customWorkType,  setCustomWorkType]  = useState('');
  const [idCardFile,      setIdCardFile]      = useState<File | null>(null);
  const [idCardPreview,   setIdCardPreview]   = useState('');
  const [mealReceiptFile, setMealReceiptFile] = useState<File | null>(null);
  const [mealPreview,      setMealPreview]      = useState('');

  const wageNum = Number(dailyWage.replace(/,/g, ''));
  const wage    = wageNum > 0 ? calcWage(wageNum) : null;

  // 최종 공정명 결정 (목공/타일... 혹은 직접 입력)
  const finalWorkType = workType === '기타' ? customWorkType.trim() : workType;

  const canProceed = !!(workerName && siteName && finalWorkType && startDate && endDate && dailyWage && managerName);

  // ── 서명 완료 후 파이어베이스 저장 ──────────────────────────────────
  const handleSignatureSave = async (blob: Blob) => {
    setView('submitting');
    try {
      // 이미지 업로드 유틸리티 (압축 포함)
      const uploadTask = async (file: File | null, pathPrefix: string) => {
        if (!file) return '';
        
        // 업로드 전 압축 적용
        const compressedFile = await compressImage(file);
        
        const safeName = workerName.replace(/[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣]/g, '');
        const path = `contract_signatures/attach_${pathPrefix}_${Date.now()}_${safeName}.jpg`;
        const r = storageRef(storage, path);
        await uploadBytes(r, compressedFile);
        return getDownloadURL(r);
      };

      // 서명 업로드
      const safeName = workerName.replace(/[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣]/g, '');
      const sigPath = `contract_signatures/sig_${Date.now()}_${safeName}.png`;
      const sigRef  = storageRef(storage, sigPath);
      await uploadBytes(sigRef, blob);
      const signatureUrl = await getDownloadURL(sigRef);

      // 신분증 및 식대 영수증 업로드 (압축 자동 적용됨)
      const idCardUrl      = await uploadTask(idCardFile, 'id_card');
      const mealReceiptUrl = await uploadTask(mealReceiptFile, 'meal_receipt');

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
        workType:        finalWorkType,
        startDate,
        endDate,
        dailyWage:       wageNum,
        wageBreakdown:   wage,
        managerName,
        signatureUrl,
        idCardUrl,
        mealReceiptUrl,
        status:          'signed',
        createdAt:       serverTimestamp(),
      });

      // 완료 후 로컬 스토리지 삭제
      localStorage.removeItem('contract_draft');
      setView('done');
    } catch (err: any) {
      console.error(err);
      setView('form');
      alert(`제출에 실패했습니다: ${err.message || '인터넷 연결을 확인 후 다시 시도해 주세요.'}`);
    }
  };

  // ── 로컬 스토리지 자동 저장/복구 ───────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('contract_draft');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setWorkerName(data.workerName || '');
        setWorkerIdNum(data.workerIdNum || '');
        setWorkerPhone(data.workerPhone || '');
        setWorkerAddress(data.workerAddress || '');
        setBankName(data.bankName || '');
        setBankAccount(data.bankAccount || '');
        setBankHolder(data.bankHolder || '');
        setSiteName(data.siteName || '');
        setWorkType(data.workType || '');
        setCustomWorkType(data.customWorkType || '');
        setDailyWage(data.dailyWage || '');
        setManagerName(data.managerName || '');
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const draft = { workerName, workerIdNum, workerPhone, workerAddress, bankName, bankAccount, bankHolder, siteName, workType, customWorkType, dailyWage, managerName };
    localStorage.setItem('contract_draft', JSON.stringify(draft));
  }, [workerName, workerIdNum, workerPhone, workerAddress, bankName, bankAccount, bankHolder, siteName, workType, customWorkType, dailyWage, managerName]);

  const reset = () => {
    localStorage.removeItem('contract_draft');
    setStep(1);
    setWorkerName(''); setWorkerIdNum(''); setWorkerPhone(''); setWorkerAddress('');
    setBankName(''); setBankAccount(''); setBankHolder('');
    setSiteName(''); setWorkType(''); setCustomWorkType(''); setStartDate(''); setEndDate('');
    setDailyWage(''); setManagerName('');
    setIdCardFile(null);
    setIdCardPreview('');
    setMealReceiptFile(null);
    setMealPreview('');
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

  // ── 계약서 작성 폼 (Wizard 스타일) ──────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f8', color: '#1a1a1a', display: 'flex', flexDirection: 'column', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => {
          if (step > 1) setStep(step - 1);
          else window.location.href = '/';
        }} style={{ background: '#f5f5f5', border: 'none', width: 32, height: 32, borderRadius: 16, fontSize: '0.9rem', cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {step > 1 ? '←' : '✕'}
        </button>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#9c2c2c' }}>ADELA CONTRACT</span>
          <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'center' }}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{ width: 20, height: 4, borderRadius: 2, background: s <= step ? '#9c2c2c' : '#eee' }} />
            ))}
          </div>
        </div>
        <div style={{ width: 32 }} />
      </div>

      <div style={{ flex: 1, padding: '24px 20px' }}>
        
        {/* Step 1: 인적사항 */}
        {step === 1 && (
          <div className="fade-in">
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>인적사항 입력</h2>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 24 }}>근로자 본인의 정보를 정확히 입력해 주세요.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>성명</label>
                <input value={workerName} onChange={e => setWorkerName(e.target.value)} placeholder="실명을 입력하세요" style={S.input} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>주민등록번호</label>
                <input value={workerIdNum} onChange={e => setWorkerIdNum(e.target.value)} placeholder="000000-0000000" style={S.input} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>연락처</label>
                <input value={workerPhone} onChange={e => setWorkerPhone(e.target.value)} placeholder="010-0000-0000" style={S.input} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>주소</label>
                <input value={workerAddress} onChange={e => setWorkerAddress(e.target.value)} placeholder="현재 거주지 주소" style={S.input} />
              </div>
            </div>
            
            <div style={{ marginTop: 32, padding: '16px', background: '#fff9f9', borderRadius: 12, border: '1px solid #ffecec' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#9c2c2c', marginBottom: 8 }}>🏦 급여 계좌 정보</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="은행명" style={{ ...S.input, flex: 1 }} />
                <input value={bankHolder} onChange={e => setBankHolder(e.target.value)} placeholder="예금주" style={{ ...S.input, flex: 1 }} />
              </div>
              <input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="계좌번호 (- 제외)" style={S.input} />
            </div>

            <button onClick={() => setStep(2)} disabled={!workerName || !workerPhone} style={{ ...S.submitBtn, marginTop: 40, background: (!workerName || !workerPhone) ? '#ccc' : '#9c2c2c' }}>다음 단계로</button>
          </div>
        )}

        {/* Step 2: 근로 여건 */}
        {step === 2 && (
          <div className="fade-in">
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>근로 조건 및 현장</h2>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 24 }}>투입되는 현장과 담당 팀장을 선택해 주세요.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>현장명</label>
                <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="현장 이름을 입력하세요" style={S.input} />
              </div>
              
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>공정명 (선택)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {WORK_TYPES.map(t => (
                    <button key={t} onClick={() => setWorkType(t)} style={{
                      padding: '10px 0', border: '1.5px solid', borderRadius: 12, fontSize: '0.85rem', fontWeight: 600,
                      borderColor: workType === t ? '#9c2c2c' : '#eee',
                      background: workType === t ? '#fff9f9' : '#fff',
                      color: workType === t ? '#9c2c2c' : '#555'
                    }}>{t}</button>
                  ))}
                </div>
                {workType === '기타' && (
                  <input value={customWorkType} onChange={e => setCustomWorkType(e.target.value)} placeholder="공정명을 직접 입력하세요" style={{ ...S.input, marginTop: 8 }} />
                )}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>시작일</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={S.input} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>종료일</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={S.input} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>일당 (단가)</label>
                <div style={{ position: 'relative' }}>
                  <input value={dailyWage} onChange={e => setDailyWage(e.target.value.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ","))} placeholder="230,000" style={{ ...S.input, paddingRight: 40 }} />
                  <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#aaa' }}>원</span>
                </div>
                {wage && (
                  <div style={{ marginTop: 12, padding: '12px', background: '#f0f0f0', borderRadius: 12, fontSize: '0.75rem', color: '#666', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    <span>• 기본급: {formatKRW(wage.base)}원</span>
                    <span>• 주휴수당: {formatKRW(wage.weekly)}원</span>
                    <span>• 연장수당: {formatKRW(wage.overtime)}원</span>
                    <span>• 휴일수당: {formatKRW(wage.holiday)}원</span>
                  </div>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#666', display: 'block', marginBottom: 6 }}>담당 매니저 (팀장)</label>
                <div onClick={() => setShowPicker(true)} style={{ ...S.input, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1.5px solid #9c2c2c', background: '#fff9f9', cursor: 'pointer' }}>
                  {managerName || <span style={{ color: '#aaa' }}>담당자를 선택하세요</span>}
                  <span style={{ fontSize: '0.7rem' }}>▼</span>
                </div>
                
                {showPicker && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: 360, borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                      <div style={{ padding: '20px', background: '#9c2c2c', color: 'white', fontWeight: 800, textAlign: 'center' }}>담당 매니저 선택</div>
                      <div style={{ maxHeight: 300, overflowY: 'auto', padding: '10px 0' }}>
                        {Object.entries(MANAGERS).map(([dept, names]) => (
                          <div key={dept}>
                            <div style={{ padding: '10px 20px', background: '#f8f8f8', fontSize: '0.75rem', fontWeight: 800, color: '#999' }}>{dept}</div>
                            {names.map(name => (
                              <div key={name} onClick={() => { setManagerName(name); setShowPicker(false); }} style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontSize: '1rem', fontWeight: 600, color: '#333' }}>{name}</div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setShowPicker(false)} style={{ width: '100%', padding: 20, border: 'none', background: '#f0f0f0', color: '#666', fontWeight: 700 }}>닫기</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button onClick={() => setStep(3)} disabled={!siteName || !managerName || !startDate} style={{ ...S.submitBtn, marginTop: 40, background: (!siteName || !managerName || !startDate) ? '#ccc' : '#9c2c2c' }}>다음 단계로</button>
          </div>
        )}

        {/* Step 3: 서류 첨부 */}
        {step === 3 && (
          <div className="fade-in">
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>증빙 서류 첨부</h2>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 24 }}>신분증과 식대 영수증을 촬영하거나 업로드해 주세요.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* 신분증 */}
              <div style={{ textAlign: 'center' }}>
                <label style={{ display: 'block', cursor: 'pointer' }}>
                  <div style={{ width: '100%', aspectRatio: '1/1', background: '#f0f0f0', borderRadius: 20, border: idCardPreview ? '2px solid #9c2c2c' : '2px dashed #ccc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {idCardPreview ? (
                      <img src={idCardPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="신분증" />
                    ) : (
                      <>
                        <span style={{ fontSize: '1.8rem', marginBottom: 8 }}>🪪</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888' }}>신분증 촬영</span>
                      </>
                    )}
                  </div>
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setIdCardFile(f); setIdCardPreview(URL.createObjectURL(f)); }
                  }} />
                </label>
              </div>

              {/* 영수증 */}
              <div style={{ textAlign: 'center' }}>
                <label style={{ display: 'block', cursor: 'pointer' }}>
                  <div style={{ width: '100%', aspectRatio: '1/1', background: '#f0f0f0', borderRadius: 20, border: mealPreview ? '2px solid #9c2c2c' : '2px dashed #ccc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {mealPreview ? (
                      <img src={mealPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="영수증" />
                    ) : (
                      <>
                        <span style={{ fontSize: '1.8rem', marginBottom: 8 }}>🧾</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888' }}>식대 영수증</span>
                      </>
                    )}
                  </div>
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setMealReceiptFile(f); setMealPreview(URL.createObjectURL(f)); }
                  }} />
                </label>
              </div>
            </div>

            <div style={{ marginTop: 24, padding: 16, background: '#fcfcfc', borderRadius: 16, border: '1px solid #eee', fontSize: '0.8rem', color: '#888', lineHeight: 1.6 }}>
              • 촬영된 사진은 서버 업로드 시 자동 압축되어 전송됩니다. <br/>
              • <strong style={{ color: '#333' }}>신분증 사진은 필수사항입니다.</strong>
            </div>

            <button onClick={() => setStep(4)} disabled={!idCardFile} style={{ ...S.submitBtn, marginTop: 40, background: !idCardFile ? '#ccc' : '#9c2c2c' }}>다음 단계로</button>
          </div>
        )}

        {/* Step 4: 확인 및 서명 안내 */}
        {step === 4 && (
          <div className="fade-in">
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>마지막 단계</h2>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 24 }}>입력하신 내용을 확인하고 서명을 진행해 주세요.</p>
            
            <div style={{ background: '#fff', borderRadius: 20, border: '1.5px solid #000', padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
              <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 12, marginBottom: 16 }}>
                <span style={{ fontSize: '0.7rem', color: '#999', fontWeight: 800 }}>확인된 근로자 정보</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1a1a1a', marginTop: 4 }}>{workerName} &nbsp; ({workerPhone})</div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>투입 현장</span>
                  <span style={{ fontWeight: 700 }}>{siteName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>시작 ~ 종료</span>
                  <span style={{ fontWeight: 700 }}>{startDate} ~ {endDate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>계약 단가</span>
                  <span style={{ fontWeight: 700, color: '#9c2c2c' }}>{dailyWage}원</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>담당 팀장</span>
                  <span style={{ fontWeight: 700 }}>{managerName}</span>
                </div>
              </div>
            </div>

            <button onClick={() => setView('signature')} style={{ ...S.submitBtn, marginTop: 40 }}>서명하러 가기</button>
          </div>
        )}

      </div>
    </div>
  );
};

// ── 스타일 ──────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  section: { padding: '28px 20px 0' },
  sectionTitle: { fontSize: '0.8rem', color: '#1a1a1a', fontWeight: 800, marginBottom: 14, letterSpacing: '0.02em' },
  label: { display: 'block', fontSize: '0.78rem', color: '#777', marginBottom: 8, fontWeight: 700 },
  input: {
    width: '100%', padding: '16px 18px', border: '1.5px solid #eee', borderRadius: 16,
    fontSize: '0.95rem', fontWeight: 600, outline: 'none', background: '#fff',
    transition: 'border-color 0.2s', boxSizing: 'border-box'
  },
  submitBtn: {
    width: '100%', padding: 20, background: '#1a1a1a', color: 'white', border: 'none',
    borderRadius: 20, fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 12px 30px rgba(0,0,0,0.15)'
  }
};

export default ContractApp;

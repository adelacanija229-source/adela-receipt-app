import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp, updateDoc, doc, deleteDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  getAuth, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { ContractApp } from './ContractApp';
import { ContractPrintView } from './ContractPrintView';

// ─── Firebase ─────────────────────────────────────────────────────
const app = initializeApp({
  apiKey: "AIzaSyA0NKS2TqEXh4QyB9SfTo_yXSjaVpq8Dso",
  authDomain: "adela-design-team.firebaseapp.com",
  projectId: "adela-design-team",
  storageBucket: "adela-design-team.firebasestorage.app",
  messagingSenderId: "334450129327",
  appId: "1:334450129327:web:e35b83fc235f492effd75a",
});
export const db = getFirestore(app);
export const storage = getStorage(app);
const auth = getAuth(app);

// ─── Constants ────────────────────────────────────────────────────
const MANAGERS: Record<string, string[]> = {
  '공무팀': ['배병선', '권재현', '양승곤', '김성진', '김현석', '권오경', '권순범', '윤재호'],
  '디자인 팀': ['김대교', '임효정', '이선민', '정예슬', '김소현', '최정은', '윤혜린', '김지연', '한아영', '김지은'],
  '설계팀': ['김승현']
};

const VEHICLES = ['195하6203', '195하8799', '196호4001', '156호7693', '43소1543'];

// ─── Types ────────────────────────────────────────────────────────
interface Report {
  id: string;
  name: string;
  site: string;
  date: string;
  amount: string;
  merchant: string;
  cardLast4: string;
  purpose: string;
  imageUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

interface Contract {
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
  wageBreakdown: { base: number; overtime: number; holiday: number; weekly: number };
  managerName: string;
  signatureUrl: string;
  idCardUrl?: string;
  mealReceiptUrl?: string;
  status: string;
  createdAt: any;
}

// ─── Helpers ─────────────────────────────────────────────────────
function timeAgo(ts: any): string {
  if (!ts?.toDate) return '방금';
  const diff = Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function formatAmount(val: string) {
  const num = parseInt(val.replace(/[^0-9]/g, ''));
  if (isNaN(num)) return val;
  return num.toLocaleString('ko-KR');
}

// ─── Image Upload ─────────────────────────────────────────────────
function uploadImage(file: File, onProgress: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `receipts/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on('state_changed',
      snap => onProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref))
    );
  });
}

// ═══════════════════════════════════════════════════════════════════
// FIELD WORKER APP
// ═══════════════════════════════════════════════════════════════════
const FieldApp = () => {
  type View = 'home' | 'scanning' | 'form' | 'uploading' | 'done';
  const [view, setView] = useState<View>('home');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');

  // Manual fields
  const [name, setName] = useState('');
  const [site, setSite] = useState('');

  // OCR-filled fields (editable)
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [purpose, setPurpose] = useState(''); // 지출 항목(용도) 추가
  const [vehicle, setVehicle] = useState(''); // 주유비 차량번호 추가

  const [uploadProgress, setUploadProgress] = useState(0);
  const [todayCount, setTodayCount] = useState(0);

  // Input refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 마지막 기록 로드
    const sn = localStorage.getItem('last_name');
    const ss = localStorage.getItem('last_site');
    if (sn) setName(sn);
    if (ss) setSite(ss);

    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      const today = new Date().toDateString();
      setTodayCount(snap.docs.filter(d => {
        const ts = d.data().createdAt;
        return ts?.toDate && ts.toDate().toDateString() === today;
      }).length);
    }, () => {});
  }, []);

  // ── 뒤로가기 방지 및 브라우저 히스토리 제어 ────────────────────────────
  useEffect(() => {
    const handlePopState = () => {
      // 업로드 중인 경우 뒤로가기를 막고 현재 상태 유지
      if (view === 'uploading') {
        window.history.pushState(null, '', window.location.href);
        return;
      }
      
      if (view === 'form') {
        const leave = window.confirm('작성 중인 내용이 사라집니다. 홈으로 돌아갈까요?');
        if (leave) {
          reset();
        } else {
          // 히스토리에 다시 상태를 추가하여 제자리 유지
          window.history.pushState(null, '', window.location.href);
        }
      } else if (view === 'done') {
        reset();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view]);

  // View 전환 시 히스토리 상태 추가 (뒤로가기 버튼을 활성화시키기 위함)
  useEffect(() => {
    if (view === 'form' || view === 'done') {
      window.history.pushState(null, '', window.location.href);
    }
  }, [view]);

  const [showPicker, setShowPicker] = useState(false);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 즉시 입력값 초기화 (연속 촬영 시 무시 방지)
    e.target.value = '';

    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));

    // 오늘 날짜 기본 세팅
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);

    // 모바일 브라우저가 사진 파일을 완전히 처리할 시간을 뒤에 확보 (100ms 지연)
    setTimeout(() => {
      setView('form');
    }, 100);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { alert('작성자 이름을 입력해주세요.'); return; }
    if (!site.trim()) { alert('현장명을 입력해주세요.'); return; }

    setView('uploading');
    setUploadProgress(0);

    let imageUrl = '';
    if (photo) {
      try {
        imageUrl = await uploadImage(photo, p => setUploadProgress(p));
      } catch {
        console.warn('사진 업로드 실패');
      }
    }

    try {
      await addDoc(collection(db, 'reports'), {
        name: name.trim(),
        site: site.trim(),
        date, amount, merchant,
        purpose: (purpose === '주유비' || purpose === '차량수리') && vehicle ? `${purpose} (${vehicle})` : purpose, // 주유/수리의 경우 차량번호 결합
        cardLast4,
        imageUrl,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // 마지막 기록 저장
      localStorage.setItem('last_name', name);
      localStorage.setItem('last_site', site);

      setView('done');
    } catch {
      setView('form');
      alert('전송 실패. 인터넷 연결을 확인해주세요.');
    }
  };

  const reset = () => {
    setPhoto(null); setPhotoPreview('');
    // 담당자와 현장은 마지막 기록 유지를 위해 초기화하지 않음
    setAmount(''); setMerchant(''); setCardLast4(''); setPurpose(''); setVehicle('');
    setUploadProgress(0);
    
    // 물리적 입력창 값 초기화
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';

    setView('home');
  };

  // ── HOME ──────────────────────────────────────────────────────
  if (view === 'home') return (
    <div style={{ 
      ...S.page, 
      justifyContent: 'center', 
      padding: '0 24px',
      background: 'linear-gradient(145deg, #fcfcfc 0%, #f0f0f0 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 장식용 배경 요소 */}
      <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(156, 44, 44, 0.03) 0%, transparent 70%)', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: '-5%', left: '-5%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(0, 122, 255, 0.02) 0%, transparent 70%)', borderRadius: '50%' }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50, position: 'relative', zIndex: 1 }}>
        
        {/* 카메라 메인 버튼 (플로팅 효과) */}
        <div style={{ position: 'relative' }}>
          <label style={{ 
            ...S.cameraBtn, 
            border: 'none', 
            background: '#fff', 
            boxShadow: '0 20px 40px rgba(0,0,0,0.08), 0 0 0 4px #fff',
            width: 100, height: 100, borderRadius: 50,
            transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }} className="hover-scale">
            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef}
              onChange={handlePhoto} style={{ display: 'none' }} />
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9c2c2c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </label>
          <div style={{ position: 'absolute', bottom: -30, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: '0.75rem', fontWeight: 800, color: '#9c2c2c', letterSpacing: '0.1em' }}>TAP TO REPORT</div>
        </div>

        {/* 대형 로고 (중앙 배치) */}
        <div style={{ width: '100%', maxWidth: 300, display: 'flex', justifyContent: 'center', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.05))' }}>
          <img src="logo.png" alt="ADELA Design Team" 
            onError={(e) => (e.currentTarget.style.display = 'none')}
            style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
        </div>

        {/* 하단 안내 및 보조 액션 */}
        <div style={{ width: '100%', textAlign: 'center', marginTop: 10 }}>
          <p style={{ color: '#aaa', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 40, fontWeight: 500 }}>RECEIPT REPORT SYSTEM <span style={{ color: '#ddd', margin: '0 4px' }}>|</span> VER 7.0 GOLD</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 260, margin: '0 auto' }}>
            <label style={{ 
              cursor: 'pointer', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', 
              border: '1px solid rgba(0,0,0,0.05)', borderRadius: 16, padding: '14px', 
              fontSize: '0.85rem', fontWeight: 700, color: '#333', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'block'
            }}>
              <input type="file" accept="image/*" ref={galleryInputRef} onChange={handlePhoto} style={{ display: 'none' }} />
              📷 OPEN GALLERY
            </label>

            <button onClick={() => window.location.href = '/contract'}
              style={{ 
                background: '#1a1a1a', border: 'none', borderRadius: 16, 
                color: 'white', fontSize: '0.85rem', cursor: 'pointer', 
                letterSpacing: '0.02em', padding: '15px', fontWeight: 700,
                boxShadow: '0 10px 20px rgba(0,0,0,0.15)'
              }}>
              📝 일용직 근로계약서 작성
            </button>
          </div>

          <button onClick={() => window.location.href = '/admin'}
            style={{ display: 'block', margin: '32px auto 0', background: 'none', border: 'none', color: '#999', fontSize: '0.72rem', cursor: 'pointer', letterSpacing: '0.05em', opacity: 0.8 }}>
            ADMIN ACCESS
          </button>
        </div>
      </div>
      
      {/* 오늘 접수 현황 (하단 정돈) */}
      <div style={{ position: 'absolute', bottom: 30, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.03)', padding: '6px 14px', borderRadius: 20 }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: '#34c759' }} />
          <span style={{ color: '#888', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.02em' }}>
            TODAY: {todayCount} REPORTS COMPLETE
          </span>
        </div>
      </div>
    </div>
  );



  // ── UPLOADING ─────────────────────────────────────────────────
  if (view === 'uploading') return (
    <div style={{ ...S.page, justifyContent: 'center', alignItems: 'center', gap: 24, padding: '0 32px' }}>
      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path><polyline points="16 16 12 12 8 16"></polyline></svg>
      <p style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '0.05em' }}>UPLOADING...</p>
      <div style={{ width: '100%' }}>
        <div style={{ height: 6, background: '#f5f5f5', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: '#9c2c2c', borderRadius: 8,
            width: `${uploadProgress || 80}%`, transition: 'width 0.4s ease'
          }} />
        </div>
      </div>
    </div>
  );

  // ── FORM ──────────────────────────────────────────────────────
  if (view === 'form') return (
    <div style={{ ...S.page, overflowY: 'auto', paddingBottom: 48 }}>
      <div style={S.formHeader}>
        <button onClick={reset} style={S.backBtn}>✕</button>
        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>영수증 정보 확인</span>
        <div style={{ width: 32 }} />
      </div>

      {photoPreview && (
        <div style={S.photoPreview}>
          <img src={photoPreview} alt="영수증" style={S.previewImg} />
        </div>
      )}

      {/* 지출 항목 (Chip) */}
      <div style={S.fieldGroup}>
        <label style={S.label}>지출 항목 <span style={{ color: '#9c2c2c' }}>*</span></label>
        <div style={S.chipRow}>
          {['주유비', '차량수리', '야근식대', '자재구매'].map(p => (
            <div key={p} onClick={() => setPurpose(p)}
              style={{ ...S.chip, ...(purpose === p ? S.chipActive : {}) }}>
              {p}
            </div>
          ))}
        </div>
        <input type="text" placeholder="기타 항목 직접 입력"
          value={['주유비', '차량수리', '야근식대', '자재구매'].includes(purpose) ? '' : purpose}
          onChange={e => setPurpose(e.target.value)}
          style={{ ...S.input, marginTop: 10, height: 44, fontSize: '0.9rem' }} />
      </div>

      {/* 주유/수리 선택 시 차량 번호 노출 */}
      {(purpose === '주유비' || purpose === '차량수리') && (
        <div style={{ ...S.fieldGroup, paddingTop: 4 }}>
          <label style={{ ...S.label, color: '#9c2c2c' }}>차량 선택 <span style={{ color: '#9c2c2c' }}>*</span></label>
          <div style={S.chipRow}>
            {VEHICLES.map(v => (
              <div key={v} onClick={() => setVehicle(v)}
                style={{ ...S.chip, fontSize: '0.82rem', padding: '8px 12px', ...(vehicle === v ? S.chipActive : {}) }}>
                {v}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 현장명 (수동) */}
      <div style={S.fieldGroup}>
        <label style={S.label}>현장명 <span style={{ color: '#9c2c2c' }}>*</span></label>
        <input type="text" placeholder="현장명 입력 (예: 압구정)"
          value={site} onChange={e => e.target.value !== undefined && setSite(e.target.value)}
          style={{ ...S.input, ...( (purpose === '야근식대' || purpose === '자재구매') ? S.autoFilled : {} ) }} />
        {(purpose === '야근식대' || purpose === '자재구매') && (
          <p style={{ fontSize: '0.75rem', color: '#9c2c2c', marginTop: 8, fontWeight: 500, letterSpacing: '-0.02em' }}>
            NOTICE: {purpose} 항목은 현장명을 정확히 기입해 주세요.
          </p>
        )}
      </div>

      {/* 날짜 */}
      <div style={S.fieldGroup}>
        <label style={S.label}>날짜 <span style={{ color: '#9c2c2c' }}>*</span></label>
        <input type="date"
          value={date} onChange={e => setDate(e.target.value)}
          style={S.input} />
      </div>

      {/* 금액 */}
      <div style={S.fieldGroup}>
        <label style={S.label}>금액 <span style={{ color: '#9c2c2c' }}>*</span></label>
        <div style={{ position: 'relative' }}>
          <input type="text" placeholder="0"
            value={amount} onChange={e => setAmount(formatAmount(e.target.value))}
            style={{ ...S.input, paddingRight: 40 }} />
          {amount && <span style={S.wonSign}>원</span>}
        </div>
      </div>


      {/* 사용처 (수동) */}
      <div style={S.fieldGroup}>
        <label style={S.label}>사용처 (상호명) <span style={{ color: '#9c2c2c' }}>*</span></label>
        <input type="text" placeholder="식당명, 철물점 등"
          value={merchant} onChange={e => setMerchant(e.target.value)}
          style={S.input} />
      </div>

      {/* 법카 끝번호 (수동) */}
      <div style={S.fieldGroup}>
        <label style={S.label}>법카 끝번호 <span style={{ color: '#9c2c2c' }}>*</span></label>
        <input type="number" inputMode="numeric" placeholder="0000"
          value={cardLast4} onChange={e => setCardLast4(e.target.value.slice(0, 4))}
          style={S.input} />
      </div>

      {/* 담당자 이름 (리스트 선택) */}
      <div style={S.fieldGroup}>
        <label style={S.label}>담당자 이름 <span style={{ color: '#9c2c2c' }}>*</span></label>
        <div onClick={() => setShowPicker(true)}
          style={{ ...S.input, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <span>{name || '담당자 선택'}</span>
          <span style={{ fontSize: '0.8rem', color: '#555' }}>▼</span>
        </div>
      </div>

      {/* 담당자 선택 모달 */}
      {showPicker && (
        <div style={S.modal} onClick={() => setShowPicker(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 20 }}>담당자 선택</p>
            {Object.entries(MANAGERS).map(([team, members]) => (
              <div key={team} style={{ marginBottom: 24 }}>
                <p style={{ fontSize: '0.85rem', color: '#9c2c2c', fontWeight: 700, marginBottom: 12 }}>{team}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {members.map(m => (
                    <button key={m} onClick={() => { setName(m); setShowPicker(false); }}
                      style={{
                        padding: '12px 18px', borderRadius: 12, background: name === m ? '#9c2c2c' : '#fff',
                        border: name === m ? '1px solid #9c2c2c' : '1px solid #eee',
                        color: name === m ? 'white' : '#555', fontSize: '0.9rem', fontWeight: name === m ? 700 : 400,
                        boxShadow: name === m ? '0 4px 10px rgba(156,44,44,0.2)' : 'none'
                      }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => setShowPicker(false)}
              style={{ width: '100%', marginTop: 10, padding: 16, background: 'transparent', color: '#888', border: '1px solid #eee', borderRadius: 14 }}>
              취소
            </button>
          </div>
        </div>
      )}



      <button onClick={handleSubmit} style={S.submitBtn}>
        보고 완료
      </button>
    </div>
  );

  // ── DONE ──────────────────────────────────────────────────────
  return (
    <div style={{ ...S.page, justifyContent: 'center', alignItems: 'center', gap: 32, paddingBottom: 60 }}>
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#9c2c2c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>REPORT SENT</p>
        <p style={{ color: '#888', marginTop: 12, lineHeight: 1.6, fontSize: '0.95rem' }}>
          관리자에게 즉시 전달됐습니다.<br />
          <span style={{ fontWeight: 600, color: '#333' }}>{name} 담당자 · {site}</span>
        </p>
      </div>
      <button onClick={reset} style={{ ...S.submitBtn, background: '#1a1a1a', marginTop: 20 }}>HOME</button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// ADMIN LOGIN
// ═══════════════════════════════════════════════════════════════════
const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      ...S.page, 
      justifyContent: 'center', 
      padding: '0 24px',
      background: '#121212',
      color: '#fff'
    }}>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ 
            width: 80, height: 80, background: 'linear-gradient(135deg, #9c2c2c 0%, #ee3a3a 100%)', 
            borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', boxShadow: '0 12px 32px rgba(156, 44, 44, 0.3)'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>ADMIN ACCESS</h2>
          <p style={{ color: '#888', marginTop: 10, fontSize: '0.85rem' }}>(주)아델라 디자인팀 관리자 전용</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <label style={{ ...S.label, color: '#666', fontSize: '0.7rem' }}>EMAIL ADDRESS</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@adela.com" 
              style={{ 
                ...S.input, 
                background: '#1e1e1e', border: '1px solid #333', 
                color: '#fff', borderRadius: 14 
              }} required />
          </div>
          <div style={{ position: 'relative' }}>
            <label style={{ ...S.label, color: '#666', fontSize: '0.7rem' }}>SECRET KEY</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" 
              style={{ 
                ...S.input, 
                background: '#1e1e1e', border: '1px solid #333', 
                color: '#fff', borderRadius: 14 
              }} required />
          </div>
          {error && <p style={{ color: '#ff453a', fontSize: '0.8rem', textAlign: 'center', marginTop: -4 }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ 
              ...S.submitBtn, 
              background: '#fff', color: '#000', 
              margin: '12px 0 0', height: 60, borderRadius: 16,
              opacity: loading ? 0.6 : 1, width: '100%',
              boxShadow: '0 10px 30px rgba(255,255,255,0.1)'
            }}>
            {loading ? 'AUTHENTICATING...' : 'LOGIN TO DASHBOARD'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <button onClick={() => window.location.href = '/'} 
            style={{ background: 'none', border: 'none', color: '#666', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
            ← BACK TO FIELD REPORT
          </button>
        </div>
      </div>

      {/* 배경 장식 */}
      <div style={{ position: 'absolute', top: '10%', right: '10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(156, 44, 44, 0.05) 0%, transparent 70%)', borderRadius: '50%' }} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════

const AdminSummary = ({ reports, contracts }: { reports: Report[], contracts: Contract[] }) => {
  const today = new Date().toDateString();
  const reportsToday = reports.filter(r => r.createdAt?.toDate?.().toDateString() === today);
  const contractsToday = contracts.filter(c => c.createdAt?.toDate?.().toDateString() === today);
  const totalAmountToday = reportsToday.reduce((sum, r) => sum + Number(r.amount.replace(/,/g, '') || 0), 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
      <div style={{ background: '#fff', padding: 20, borderRadius: 20, border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', marginBottom: 8 }}>금일 신규 계약</p>
        <p style={{ fontSize: '1.8rem', fontWeight: 900, color: '#9c2c2c' }}>{contractsToday.length}<span style={{ fontSize: '0.9rem', fontWeight: 600, marginLeft: 4 }}>건</span></p>
      </div>
      <div style={{ background: '#fff', padding: 20, borderRadius: 20, border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', marginBottom: 8 }}>금일 영수증 접수</p>
        <p style={{ fontSize: '1.8rem', fontWeight: 900, color: '#333' }}>{reportsToday.length}<span style={{ fontSize: '0.9rem', fontWeight: 600, marginLeft: 4 }}>건</span></p>
      </div>
      <div style={{ background: '#fff', padding: 20, borderRadius: 20, border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', marginBottom: 8 }}>금일 지출 합계</p>
        <p style={{ fontSize: '1.8rem', fontWeight: 900, color: '#007aff' }}>{totalAmountToday.toLocaleString()}<span style={{ fontSize: '0.9rem', fontWeight: 600, marginLeft: 4 }}>원</span></p>
      </div>
    </div>
  );
};

const AdminApp = ({ user: _user }: { user: User }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [adminTab, setAdminTab] = useState<'reports' | 'contracts'>('reports');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showContractPrint, setShowContractPrint] = useState(false);
  const [photoFull, setPhotoFull] = useState(false);

  // 검색 및 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('전체');

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'contracts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setContracts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Contract)));
    });
  }, []);

  // 모든 현장 목록 추출
  const allSites = ['전체', ...Array.from(new Set([
    ...reports.map(r => r.site),
    ...contracts.map(c => c.siteName)
  ].filter(Boolean) as string[]))];

  // 필터링된 데이터
  const filteredReports = reports.filter(r => {
    const matchesSearch = (r.name + r.merchant + r.site + r.purpose).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSite = siteFilter === '전체' || r.site === siteFilter;
    return matchesSearch && matchesSite;
  });

  const filteredContracts = contracts.filter(c => {
    const matchesSearch = (c.workerName + c.siteName + c.workType + c.managerName).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSite = siteFilter === '전체' || c.siteName === siteFilter;
    return matchesSearch && matchesSite;
  });

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    await updateDoc(doc(db, 'reports', id), { status });
    setSelectedReport(null);
  };

  // 개별 삭제
  const deleteReport = async (id: string) => {
    if (!window.confirm('이 영수증을 삭제하시겠습니까?\n삭제 후에는 복구가 불가능합니다.')) return;
    try {
      await deleteDoc(doc(db, 'reports', id));
      setSelectedReport(null);
    } catch { alert('삭제 실패. 다시 시도해주세요.'); }
  };
 
  // 계약서 삭제
  const deleteContract = async (id: string) => {
    if (!window.confirm('이 근로계약서를 삭제하시겠습니까?\n삭제 후에는 복구가 불가능합니다.')) return;
    try {
      await deleteDoc(doc(db, 'contracts', id));
      setSelectedContract(null);
    } catch { alert('삭제 실패. 다시 시도해주세요.'); }
  };

  const downloadImage = (url: string) => {
    const a = document.createElement('a');
    a.href = url; a.download = `receipt_${Date.now()}.jpg`;
    a.target = '_blank'; a.rel = 'noopener noreferrer'; a.click();
  };

  return (
    <div style={S.page}>
      <div style={S.header} className="hide-on-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => window.location.href = '/'} 
            style={{ background: 'none', border: 'none', color: '#1a1a1a', fontSize: '0.9rem', cursor: 'pointer', padding: 0, fontWeight: 700 }}>HOME</button>
          <span style={{ fontSize: '0.8rem', color: '#ddd' }}>|</span>
          <img src="logo.png" alt="ADELA" style={{ height: 20, width: 'auto', objectFit: 'contain' }} />
          <span style={{ ...S.logo, fontSize: '0.85rem', color: '#888', fontWeight: 400, letterSpacing: '0.05em' }}>ADMIN</span>
        </div>
        <button onClick={() => signOut(auth)}
          style={{ background: '#fff', border: '1px solid #eee', color: '#888', padding: '6px 12px', borderRadius: 20, fontSize: '0.8rem', cursor: 'pointer' }}>
          로그아웃
        </button>
      </div>

      {/* 메인 내용 */}
      <div style={{ maxWidth: 1000, margin: '0 auto', width: '100%', padding: '0 20px 60px' }}>
        
        {/* 요약 정보 영역 */}
        <AdminSummary reports={reports} contracts={contracts} />

        {/* 탭 및 필터 바 */}
        <div style={{ background: '#fff', borderRadius: 24, padding: '8px', display: 'flex', gap: 8, marginBottom: 20, border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <button onClick={() => setAdminTab('reports')} style={{
            flex: 1, padding: '14px', borderRadius: 18, border: 'none', fontWeight: 800, cursor: 'pointer',
            background: adminTab === 'reports' ? '#1a1a1a' : 'transparent',
            color: adminTab === 'reports' ? '#fff' : '#888',
          }}>영수증 내역 ({reports.length})</button>
          <button onClick={() => setAdminTab('contracts')} style={{
            flex: 1, padding: '14px', borderRadius: 18, border: 'none', fontWeight: 800, cursor: 'pointer',
            background: adminTab === 'contracts' ? '#1a1a1a' : 'transparent',
            color: adminTab === 'contracts' ? '#fff' : '#888',
          }}>근로계약서 ({contracts.length})</button>
        </div>

        {/* 검색 및 현장 필터 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 260, position: 'relative' }}>
            <input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="검색어 입력 (이름, 현장, 업체명...)"
              style={{ ...S.input, paddingLeft: 44, height: 54 }}
            />
            <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }}>🔍</span>
          </div>
          <select 
            value={siteFilter}
            onChange={e => setSiteFilter(e.target.value)}
            style={{ ...S.input, flex: 1, minWidth: 140, height: 54, padding: '0 16px' }}
          >
            {allSites.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {adminTab === 'reports' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 12 }}>
            {filteredReports.map(r => <ReportRow key={r.id} r={r} onClick={() => setSelectedReport(r)} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {filteredContracts.map(c => (
              <div key={c.id} 
                style={{ 
                  background: '#fff', border: '1px solid #f0f0f0', borderRadius: 20, 
                  padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                  display: 'flex', flexDirection: 'column', gap: 14, cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative', overflow: 'hidden'
                }} className="contract-card"
                onClick={() => setSelectedContract(c)}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{c.workerName}</h3>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#34c75915', color: '#34c759' }}>SIGNED</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#888' }}>{c.siteName}</p>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#9c2c2c', background: '#9c2c2c10', padding: '4px 10px', borderRadius: 8, fontWeight: 700 }}>{c.workType}</span>
                </div>

                <div style={{ height: 1, background: '#f5f5f5' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', color: '#aaa', marginBottom: 2 }}>DAILY WAGE</label>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1a1a1a' }}>₩ {(Number(c.dailyWage?.toString().replace(/,/g, '')) || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <label style={{ display: 'block', fontSize: '0.65rem', color: '#aaa', marginBottom: 2 }}>PERIOD</label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>{(c.startDate || '').slice(5)} ~ {(c.endDate || '').slice(5)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 12, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>👤</div>
                    <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 500 }}>{c.managerName || '배병선'} 소장</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteContract(c.id); }}
                    style={{ background: '#fff1f1', border: 'none', color: '#ff3b30', fontSize: '0.8rem', cursor: 'pointer', padding: '6px 10px', borderRadius: 8, fontWeight: 600 }}>
                    DELETE
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 40 }} />


      {/* 영수증 상세 모달 */}
      {selectedReport && !photoFull && (
        <div style={S.modal} onClick={() => setSelectedReport(null)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>영수증 상세 정보</h3>
              <button onClick={() => setSelectedReport(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            
            {selectedReport.imageUrl && (
              <div style={{ marginBottom: 20 }}>
                <img src={selectedReport.imageUrl} alt=""
                  onClick={() => setPhotoFull(true)}
                  style={{ width: '100%', borderRadius: 16, maxHeight: 300, objectFit: 'contain', cursor: 'pointer', background: '#f9f9f9' }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={S.modalRow}><span style={{ color: '#aaa' }}>작성자</span><strong>{selectedReport.name}</strong></div>
              <div style={S.modalRow}><span style={{ color: '#aaa' }}>현장</span><strong>{selectedReport.site}</strong></div>
              <div style={S.modalRow}><span style={{ color: '#aaa' }}>금액</span><strong style={{ color: '#9c2c2c', fontSize: '1.1rem' }}>{selectedReport.amount}원</strong></div>
              <div style={S.modalRow}><span style={{ color: '#aaa' }}>항목/목적</span><strong>{selectedReport.purpose}</strong></div>
              <div style={S.modalRow}><span style={{ color: '#aaa' }}>사용처</span><strong>{selectedReport.merchant}</strong></div>
              <div style={S.modalRow}><span style={{ color: '#aaa' }}>상태</span>
                <strong style={{ color: selectedReport.status === 'pending' ? '#ff9500' : selectedReport.status === 'approved' ? '#34c759' : '#ff3b30' }}>
                  {selectedReport.status === 'pending' ? '대기' : selectedReport.status === 'approved' ? '승인' : '반려'}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              {selectedReport.status === 'pending' && (
                <>
                  <button onClick={() => updateStatus(selectedReport.id, 'rejected')} 
                    style={{ flex: 1, padding: 14, borderRadius: 14, border: '1px solid #ff3b30', color: '#ff3b30', background: '#fff', fontWeight: 700 }}>반려</button>
                  <button onClick={() => updateStatus(selectedReport.id, 'approved')}
                    style={{ flex: 2, padding: 14, borderRadius: 14, border: 'none', color: '#fff', background: '#1a1a1a', fontWeight: 700 }}>승인</button>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={() => deleteReport(selectedReport.id)}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #eee', color: '#ff3b30', background: '#fff', fontSize: '0.85rem' }}>이 기록 삭제</button>
              <button onClick={() => setSelectedReport(null)}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #eee', color: '#888', background: '#fff', fontSize: '0.85rem' }}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 사진 전체화면 */}
      {photoFull && selectedReport?.imageUrl && (
        <div onClick={() => setPhotoFull(false)}
          style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={selectedReport.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          <div style={{ position: 'absolute', top: 20, right: 16, display: 'flex', gap: 10 }}>
            <button onClick={e => { e.stopPropagation(); downloadImage(selectedReport.imageUrl!); }}
              style={{ background: '#007aff', color: 'white', border: 'none', borderRadius: 40, padding: '10px 20px', fontWeight: 600 }}>저장</button>
            <button onClick={() => setPhotoFull(false)}
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 40, padding: '10px 20px' }}>닫기</button>
          </div>
        </div>
      )}

      {/* 계약서 상세 모달 */}
      {selectedContract && adminTab === 'contracts' && (
        <div style={S.modal} onClick={() => setSelectedContract(null)}>
          <div style={{ ...S.modalBox, maxHeight: '92vh', padding: '12px 10px 30px' }} onClick={e => e.stopPropagation()}>
            {/* 상단 타이틀 */}
            <div style={{ textAlign: 'center', marginBottom: '8px', position: 'relative' }}>
              <button onClick={() => setSelectedContract(null)} style={{ position: 'absolute', left: 0, top: 0, background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10 }}>✕</button>
              <h2 style={{ 
                display: 'inline-block',
                border: '1.5px solid #000',
                padding: '2px 20px',
                fontSize: '1rem',
                letterSpacing: '5px',
                fontWeight: 900,
                margin: '0'
              }}>일 용 근 로 계 약 서 (40h)</h2>
            </div>

            {/* 메인 테이블 (스크롤 가능하도록 감쌈) */}
            <div style={{ width: '100%', overflowX: 'auto', marginBottom: '20px' }}>
              <div style={{ minWidth: '320px' }}>
                {/* 사용자/근로자 정보 테이블 */}
                <table className="premium-table" style={{ marginBottom: '10px' }}>
                  <tbody>
                    <tr>
                      <th rowSpan={2} style={{ width: '12%' }}>
                        <div className="vertical-label" style={{ fontSize: '0.65rem' }}>
                          <span>(</span><span>甲</span><span>)</span>
                          <span style={{ marginTop: '2px' }}>사</span><span>용</span><span>자</span>
                        </div>
                      </th>
                      <td style={{ width: '15%', textAlign: 'center', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>상 호</td>
                      <td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>㈜ 아 델 라</td>
                      <td style={{ width: '18%', textAlign: 'center', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>현장소장</td>
                      <td style={{ textAlign: 'center' }}>{selectedContract.managerName || '배병선'}</td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: 'center', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>주 소</td>
                      <td colSpan={5} style={{ textAlign: 'center', fontSize: '0.62rem' }}>서울 강남구 학동로 11길 56 백송B/D 2층</td>
                    </tr>
                    <tr>
                      <th rowSpan={2}>
                        <div className="vertical-label" style={{ fontSize: '0.65rem' }}>
                          <span>(</span><span>乙</span><span>)</span>
                          <span style={{ marginTop: '2px' }}>근</span><span>로</span><span>자</span>
                        </div>
                      </th>
                      <td style={{ textAlign: 'center', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>성 명</td>
                      <td colSpan={3} style={{ textAlign: 'center', fontWeight: 'bold' }}>{selectedContract.workerName}</td>
                      <td style={{ textAlign: 'center', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>주민번호</td>
                      <td style={{ textAlign: 'center' }}>{selectedContract.workerIdNum}</td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: 'center', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>주 소</td>
                      <td colSpan={3} style={{ textAlign: 'center', fontSize: '0.62rem' }}>{selectedContract.workerAddress}</td>
                      <td style={{ textAlign: 'center', backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>핸드폰</td>
                      <td style={{ textAlign: 'center' }}>{selectedContract.workerPhone}</td>
                    </tr>
                    <tr>
                      <th style={{ backgroundColor: '#f2f2f2', fontWeight: 'bold' }}>계좌번호</th>
                      <td colSpan={2} style={{ textAlign: 'center', fontWeight: 'bold' }}>{selectedContract.bankAccount}</td>
                      <td style={{ width: '20%', textAlign: 'center', fontSize: '0.65rem' }}>은행: {selectedContract.bankName}</td>
                      <td colSpan={3} style={{ textAlign: 'right', fontSize: '0.65rem' }}>예금주: {selectedContract.bankHolder}</td>
                    </tr>
                  </tbody>
                </table>

                {/* 중간 상세 정보 테이블 */}
                <table className="premium-table">
                  <tbody>
                    <tr>
                      <th style={{ width: '15%', verticalAlign: 'middle', padding: '5px 0' }}>
                        <div className="vertical-label" style={{ fontSize: '0.62rem' }}>
                          <span>근</span><span>로</span><span>장</span><span>소</span>
                        </div>
                      </th>
                      <td style={{ fontSize: '0.68rem' }}>각 현 장 ( 현장명 : <strong>{selectedContract.siteName}</strong> )</td>
                    </tr>
                    <tr>
                      <th style={{ padding: '6px 0' }}>
                        <div className="vertical-label" style={{ fontSize: '0.62rem' }}>
                          <span>계</span><span>약</span><span>기</span><span>간</span>
                        </div>
                      </th>
                      <td style={{ fontSize: '0.62rem', padding: '3px 6px' }}>
                        기간: <strong>{selectedContract.startDate}</strong> ~ <strong>{selectedContract.endDate}</strong><br/>
                        * 일용직 근로계약이며, 공정 종료 시 자동 종료됩니다.
                      </td>
                    </tr>
                    <tr>
                      <th style={{ padding: '8px 0' }}>
                        <div className="vertical-label" style={{ fontSize: '0.68rem' }}>
                          <span>임</span>
                          <span style={{ fontSize: '0.3rem', opacity: 0 }}>&nbsp;</span>
                          <span>금</span>
                        </div>
                      </th>
                      <td style={{ padding: '0' }}>
                        <div style={{ padding: '3px 6px', borderBottom: '0.5px solid #000', fontSize: '0.64rem' }}>
                          포괄산정임금 일당: <strong>₩ {(selectedContract.dailyWage || 0).toLocaleString()}</strong>
                        </div>
                        <div style={{ padding: '3px 6px', fontSize: '0.58rem' }}>
                          기본: { (selectedContract.wageBreakdown?.base || 0).toLocaleString() } / 
                          주휴: { (selectedContract.wageBreakdown?.weekly || 0).toLocaleString() } / 
                          연장: { (selectedContract.wageBreakdown?.overtime || 0).toLocaleString() }
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 첨부 서류 (신분증 & 영수증) - 모달 가독성을 위해 그리드 배치 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
              <div>
                <p style={{ fontSize: '0.65rem', color: '#9c2c2c', fontWeight: 800, marginBottom: '6px' }}>[신분증]</p>
                <div style={{ border: '1px solid #eee', borderRadius: 8, height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fcfcfc' }}>
                  {selectedContract.idCardUrl ? (
                    <img src={selectedContract.idCardUrl} alt="신분증" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onClick={() => setPhotoFull(true)} />
                  ) : <span style={{ fontSize: '0.6rem', color: '#ccc' }}>미첨부</span>}
                </div>
              </div>
              <div>
                <p style={{ fontSize: '0.65rem', color: '#9c2c2c', fontWeight: 800, marginBottom: '6px' }}>[식대 영수증]</p>
                <div style={{ border: '1px solid #eee', borderRadius: 8, height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fcfcfc' }}>
                  {selectedContract.mealReceiptUrl ? (
                    <img src={selectedContract.mealReceiptUrl} alt="영수증" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onClick={() => setPhotoFull(true)} />
                  ) : <span style={{ fontSize: '0.6rem', color: '#ccc' }}>미첨부</span>}
                </div>
              </div>
            </div>

            {/* 서명 확인 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1.5px solid #000', borderRadius: 12, marginBottom: '20px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>근로자 ( 乙 ) 서명 확인</div>
              <div style={{ position: 'relative', width: '60px', height: '40px' }}>
                {selectedContract.signatureUrl ? (
                  <img src={selectedContract.signatureUrl} alt="서명" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : <span style={{ color: '#ff3b30', fontSize: '0.7rem' }}>미서명</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowContractPrint(true)}
                style={{ flex: 2, padding: 16, background: '#1a1a1a', color: 'white', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: '0.95rem' }}>
                🖨️ 계약서 인쇄 / PDF 다운로드
              </button>
              <button 
                 onClick={(e) => { e.stopPropagation(); deleteContract(selectedContract.id); }}
                 style={{ flex: 1, padding: 16, background: '#fff', color: '#ff3b30', border: '1px solid #ff3b30', borderRadius: 14, fontWeight: 700, fontSize: '0.95rem' }}>
                삭제
              </button>
            </div>
            <button onClick={() => setSelectedContract(null)}
              style={{ width: '100%', marginTop: 10, padding: 14, background: 'transparent', color: '#888', border: '1px solid #eee', borderRadius: 14 }}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 인쇄 뷰 띄우기 */}
      {showContractPrint && selectedContract && (
        <ContractPrintView contract={selectedContract} onClose={() => setShowContractPrint(false)} />
      )}


    </div>
  );
};

const ReportRow = ({ r, onClick }: { r: Report; onClick: () => void }) => (
  <div onClick={onClick} style={S.row}>
    {r.imageUrl
      ? <img src={r.imageUrl} alt="" style={S.thumb} />
      : <div style={{ ...S.thumb, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
        </div>
    }
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <div style={{ fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {r.merchant || r.site}
        </span>
        {r.amount && (
          <span style={{ color: '#9c2c2c', fontWeight: 800, flexShrink: 0, fontSize: '0.9rem' }}>
            {r.amount}원
          </span>
        )}
      </div>
      <div style={{ fontSize: '0.78rem', color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
        {r.purpose && <span style={{ color: '#007aff', fontWeight: 600 }}>[{r.purpose}]</span>}
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name} · {r.site}</span>
      </div>
      <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: 2 }}>{timeAgo(r.createdAt)}</div>
    </div>
    <div style={{
      fontSize: '0.7rem', fontWeight: 600, padding: '4px 10px', borderRadius: 4, flexShrink: 0,
      border: '1px solid #eee',
      color: r.status === 'pending' ? '#999' : r.status === 'approved' ? '#333' : '#bbb',
    }}>
      {r.status === 'pending' ? 'PENDING' : r.status === 'approved' ? 'DONE' : 'REJECTED'}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const path    = window.location.pathname;
  const isAdmin    = path === '/admin';
  const isContract = path === '/contract';
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) { setAuthLoading(false); return; }
    return onAuthStateChanged(auth, u => {
      setUser(u); setAuthLoading(false);
    });
  }, [isAdmin]);

  if (isContract) return <ContractApp />;
  if (!isAdmin) return <FieldApp />;
  if (authLoading) return (
    <div style={{ ...S.page, justifyContent: 'center', alignItems: 'center' }}>
      <p style={{ color: '#333' }}>로딩 중...</p>
    </div>
  );
  if (!user) return <AdminLogin />;
  return <AdminApp user={user} />;
}

// ─── Styles ───────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', background: '#fcfcfc', color: '#1a1a1a',
    display: 'flex', flexDirection: 'column',
    fontFamily: "'Pretendard', -apple-system, sans-serif",
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 0' },
  logo: { fontSize: '1.1rem', fontWeight: 800, color: '#333' },
  badge: { background: '#9c2c2c', color: 'white', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20 },
  heroArea: { padding: '32px 20px 24px', textAlign: 'center' },
  heroTitle: { fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#1a1a1a' },
  heroSub: { color: '#666', marginTop: 8, fontSize: '0.9rem' },
  cameraBtn: {
    margin: '0 auto', background: '#fff',
    border: '2px solid #9c2c2c20', width: 80, height: 80,
    borderRadius: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 8px 24px rgba(156, 44, 44, 0.12)',
  },
  galleryBtn: {
    margin: '20px 20px 0', background: '#fff', border: '1px solid #eee',
    borderRadius: 14, padding: '16px', textAlign: 'center',
    fontSize: '0.95rem', color: '#555', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  },
  formHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid #f0f0f0', background: '#fff' },
  backBtn: { background: 'none', border: 'none', color: '#333', fontSize: '1.2rem', cursor: 'pointer', padding: 4 },
  photoPreview: { margin: '12px 20px 0', borderRadius: 20, overflow: 'hidden', maxHeight: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
  previewImg: { width: '100%', height: 200, objectFit: 'cover', display: 'block' },
  aiSection: { padding: '16px 20px 4px' },
  aiLabel: { fontSize: '0.8rem', color: '#9c2c2c', fontWeight: 700, margin: 0 },
  fieldGroup: { padding: '14px 20px 0' },
  label: { display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: 8, fontWeight: 600 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { padding: '10px 18px', borderRadius: 40, background: '#f5f5f5', border: '1px solid #efefef', color: '#666', fontSize: '0.9rem', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' },
  chipActive: { background: '#9c2c2c10', border: '1px solid #9c2c2c', color: '#9c2c2c', fontWeight: 700 },
  input: { width: '100%', padding: '16px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 16, color: '#1a1a1a', fontSize: '1rem', fontFamily: 'inherit', boxSizing: 'border-box' },
  autoFilled: { borderColor: '#9c2c2c40', background: '#9c2c2c05' },
  wonSign: { position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: '#999', fontSize: '0.9rem' },
  divider: { display: 'flex', alignItems: 'center', gap: 12, padding: '24px 20px 4px' },
  dividerLine: { flex: 1, height: 1, background: '#eee' },
  dividerText: { color: '#aaa', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' },
  submitBtn: { margin: '24px 20px 0', padding: '18px', borderRadius: 18, background: '#9c2c2c', color: 'white', border: 'none', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', width: 'calc(100% - 40px)', WebkitTapHighlightColor: 'transparent', boxShadow: '0 8px 24px rgba(156, 44, 44, 0.2)' },
  spinner: {
    width: 44, height: 44, borderRadius: '50%',
    border: '4px solid #f0f0f0', borderTopColor: '#9c2c2c',
    animation: 'spin 0.8s linear infinite', margin: '0 auto',
  },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 },
  modalBox: { background: '#fff', borderRadius: '32px 32px 0 0', padding: '28px 20px 56px', width: '100%', maxHeight: '92vh', overflowY: 'auto' },
  modalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f8f8f8', fontSize: '0.95rem' },
  photoBtn: { background: 'rgba(255,255,255,0.9)', color: '#333', border: '1px solid #eee', borderRadius: 20, padding: '8px 16px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 },
  row: { display: 'flex', alignItems: 'center', gap: 14, padding: '15px 20px', background: '#fff', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' },
  thumb: { width: 60, height: 60, borderRadius: 14, objectFit: 'cover', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  subActionBtn: { background: '#fff', border: '1px solid #eee', padding: '8px 16px', borderRadius: 40, fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600, color: '#555' },
  reportCard: { background: 'white', color: 'black', borderRadius: 20, padding: 28, marginBottom: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0', pageBreakInside: 'avoid' as'avoid' },
  reportHeader: { display: 'flex', borderBottom: '1px solid #f0f0f0', paddingBottom: 20 },
};

// CSS for print and animations
const style = document.createElement('style');
style.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  /* --- 인쇄 미리보기 화면 모드 (A4 시뮬레이션) --- */
  .print-area { background: #f0f0f0 !important; }
  .premium-table { width: 100%; border-collapse: collapse; border: 1px solid #000; font-family: 'Pretendard', sans-serif; }
  .premium-table td { border: 1px solid #000; padding: 2px 4px; font-size: 0.68rem; line-height: 1.15; vertical-align: middle; }
  .premium-table th { background-color: #f2f2f2; border: 1px solid #000; font-weight: bold; text-align: center; vertical-align: middle; letter-spacing: 1px; word-break: keep-all; }
  .vertical-label { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; padding: 1px 0; }
  .print-pages { width: 100%; padding: 20px 0; font-family: sans-serif; }
  .print-page {
    width: 210mm;
    height: 297mm;
    margin: 0 auto 30px;
    background: white;
    box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    padding: 10mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  .print-grid {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr) !important;
    grid-template-rows: repeat(3, 1fr) !important;
    gap: 16px !important;
    flex: 1;
    min-height: 0; 
  }
  .report-card { 
    border: 1px solid #ddd !important; 
    margin-bottom: 0 !important; 
    padding: 16px !important;
    box-shadow: none !important;
    display: flex !important;
    flex-direction: column !important;
  }
  .print-img-wrap {
    flex: 1;
    position: relative;
    margin-top: 12px;
  }
  .print-img {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
    border-radius: 8px !important;
    margin-top: 0 !important;
  }

  /* --- 실제 종이 인쇄 모드 (프린터 전송 시) --- */
  @media print {
    .hide-on-print { display: none !important; }
    .print-area { position: static !important; background: white !important; padding: 0 !important; display: block !important; overflow: visible !important; }
    body { background: white !important; }
    
    .print-pages { padding: 0; }
    .print-page {
      margin: 0;
      box-shadow: none;
      page-break-after: always;
      break-after: page;
    }
    .print-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;
document.head.appendChild(style);

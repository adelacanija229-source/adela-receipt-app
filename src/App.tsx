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

// ─── Firebase ─────────────────────────────────────────────────────
const app = initializeApp({
  apiKey: "AIzaSyA0NKS2TqEXh4QyB9SfTo_yXSjaVpq8Dso",
  authDomain: "adela-design-team.firebaseapp.com",
  projectId: "adela-design-team",
  storageBucket: "adela-design-team.firebasestorage.app",
  messagingSenderId: "334450129327",
  appId: "1:334450129327:web:e35b83fc235f492effd75a",
});
const db = getFirestore(app);
const storage = getStorage(app);
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
    <div style={{ ...S.page, justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 60 }}>
        
        {/* 카메라 라인 아이콘 (로고 위) */}
        <label style={{ ...S.cameraBtn, border: 'none', boxShadow: 'none', background: 'transparent' }}>
          <input type="file" accept="image/*" capture="environment" ref={cameraInputRef}
            onChange={handlePhoto} style={{ display: 'none' }} />
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
        </label>

        {/* 대형 로고 (중앙 배치) */}
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', justifyContent: 'center' }}>
          <img src="logo.png" alt="ADELA Design Team" 
            onError={(e) => (e.currentTarget.style.display = 'none')}
            style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
        </div>

        {/* 하단 안내 및 보조 액션 */}
        <div style={{ width: '100%', textAlign: 'center' }}>
          <p style={{ color: '#aaa', fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 32 }}>RECEIPT REPORT SYSTEM</p>
          
          <label style={{ cursor: 'pointer', color: '#1a1a1a', fontWeight: 600, fontSize: '0.9rem', borderBottom: '1px solid #1a1a1a', paddingBottom: 4 }}>
            <input type="file" accept="image/*" ref={galleryInputRef} onChange={handlePhoto} style={{ display: 'none' }} />
            OPEN GALLERY
          </label>

          <button onClick={() => window.location.href = '/admin'}
            style={{ display: 'block', margin: '48px auto 0', background: 'none', border: 'none', color: '#888', fontSize: '0.75rem', cursor: 'pointer', letterSpacing: '0.05em' }}>
            ADMIN ACCESS
          </button>
        </div>
      </div>
      
      {/* 오늘 접수 현황 (하단 정돈) */}
      <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ color: '#ccc', fontSize: '0.65rem', fontWeight: 500 }}>
          TOTAL SUBMISSIONS TODAY: {todayCount}
        </span>
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
    <div style={{ ...S.page, justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
        <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>관리자 로그인</p>
        <p style={{ color: '#555', marginTop: 8, fontSize: '0.9rem' }}>(주)아델라 관리자 전용</p>
      </div>
      <div style={{ position: 'absolute', top: 20, left: 20 }}>
        <button onClick={() => window.location.href = '/'} 
          style={{ background: 'none', border: '1px solid #eee', color: '#999', padding: '8px 12px', borderRadius: 20, fontSize: '0.8rem', cursor: 'pointer' }}>
          ⬅ 홈으로
        </button>
      </div>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={S.label}>이메일</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="admin@adela.com" style={S.input} required />
        </div>
        <div>
          <label style={S.label}>비밀번호</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호 입력" style={S.input} required />
        </div>
        {error && <p style={{ color: '#ff3b30', fontSize: '0.85rem', textAlign: 'center' }}>{error}</p>}
        <button type="submit" disabled={loading}
          style={{ ...S.submitBtn, margin: '8px 0 0', opacity: loading ? 0.6 : 1 }}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// ADMIN APP
// ═══════════════════════════════════════════════════════════════════
const AdminApp = ({ user }: { user: User }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [photoFull, setPhotoFull] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteBeforeDate, setDeleteBeforeDate] = useState('');
  const [deleting, setDeleting] = useState(false);

  // CSV 다운로드 (UTF-8 BOM 추가 및 완벽한 예외 처리)
  const downloadCSV = () => {
    if (!reports || reports.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    const headers = ['날짜', '담당자', '현장명', '금액(원)', '항목', '사용처', '법카번호', '상태', '이미지링크'];
    
    try {
      const sorted = [...reports].sort((a, b) => {
        const siteCompare = (a.site || '').localeCompare(b.site || '', 'ko');
        if (siteCompare !== 0) return siteCompare;
        return (a.date || '').localeCompare(b.date || '');
      });

      const rows = sorted.map((r: Report) => [
        r.date || '',
        r.name || '',
        r.site || '',
        (r.amount || '').toString().replace(/,/g, ''),
        r.purpose || '',
        r.merchant || '',
        r.cardLast4 || '',
        r.status === 'approved' ? '승인' : r.status === 'rejected' ? '반려' : '대기',
        r.imageUrl || ''
      ]);

      const csvString = [headers, ...rows]
        .map(e => e.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob(["\ufeff" + csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `영수증정산_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 150);
    } catch (e) {
      console.error("CSV Download Error:", e);
      alert("엑셀 생성 중 오류가 발생했습니다.");
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
    }, () => {});
  }, []);

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    await updateDoc(doc(db, 'reports', id), { status });
    setSelected(null);
  };

  // 개별 삭제
  const deleteReport = async (id: string) => {
    if (!window.confirm('이 영수증을 삭제하시겠습니까?\n삭제 후에는 복구가 불가능합니다.')) return;
    try {
      await deleteDoc(doc(db, 'reports', id));
      setSelected(null);
    } catch { alert('삭제 실패. 다시 시도해주세요.'); }
  };

  // 기간 일괄 삭제
  const bulkDeleteBefore = async () => {
    if (!deleteBeforeDate) { alert('날짜를 선택해주세요.'); return; }
    const targets = reports.filter(r => r.date && r.date < deleteBeforeDate);
    if (targets.length === 0) { alert('해당 기간에 삭제할 데이터가 없습니다.'); return; }
    if (!window.confirm(`${deleteBeforeDate} 이전 영수증 ${targets.length}건을 삭제합니다.\n엑셀 백업 후 진행하세요. 계속하시겠습니까?`)) return;
    setDeleting(true);
    try {
      await Promise.all(targets.map(r => deleteDoc(doc(db, 'reports', r.id))));
      setShowDeleteModal(false);
      setDeleteBeforeDate('');
      alert(`${targets.length}건이 삭제되었습니다.`);
    } catch { alert('일부 삭제에 실패했습니다.'); }
    finally { setDeleting(false); }
  };

  const downloadImage = (url: string) => {
    const a = document.createElement('a');
    a.href = url; a.download = `receipt_${Date.now()}.jpg`;
    a.target = '_blank'; a.rel = 'noopener noreferrer'; a.click();
  };

  const pending = reports.filter(r => r.status === 'pending');
  const done = reports.filter(r => r.status !== 'pending');

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {pending.length > 0 && (
            <span style={{ ...S.badge, background: '#f5f5f5', color: '#333', borderRadius: 4, padding: '2px 8px', fontSize: '0.7rem', border: '1px solid #eee' }}>PENDING: {pending.length}</span>
          )}
          <button onClick={downloadCSV} style={{ ...S.subActionBtn, color: '#1a1a1a', borderColor: '#eee' }}>EXCEL</button>
          <button onClick={() => setShowReport(true)} style={{ ...S.subActionBtn, color: '#1a1a1a', borderColor: '#eee' }}>REPORT</button>
          <button onClick={() => setShowDeleteModal(true)} style={{ ...S.subActionBtn, color: '#9c2c2c', borderColor: '#9c2c2c40' }}>DELETE</button>
          <button onClick={() => signOut(auth)}
            style={{ background: '#fff', border: '1px solid #eee', color: '#888', padding: '6px 12px', borderRadius: 20, fontSize: '0.8rem', cursor: 'pointer' }}>
            로그아웃
          </button>
        </div>
      </div>

      {/* 리포트 모드 (인쇄용) - 활성화 시 메인 목록을 완전히 숨김 */}
      {showReport && (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 3000, overflowY: 'auto' }} className="print-area">
          <div style={{ ...S.header, background: '#fff', color: '#333', padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }} className="hide-on-print">
            <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>인쇄용 리포트 미리보기</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => window.print()} style={{ ...S.submitBtn, margin: 0, padding: '10px 20px', fontSize: '0.9rem' }}>🖨️ 인쇄/PDF 저장</button>
              <button onClick={() => setShowReport(false)} style={{ ...S.subActionBtn, color: '#333', borderColor: '#eee', padding: '8px 16px' }}>닫기</button>
            </div>
          </div>
          <div className="print-pages">
            {Array.from({ length: Math.ceil(reports.length / 6) }).map((_, pageIdx) => {
              const pageGroup = reports.slice(pageIdx * 6, pageIdx * 6 + 6);
              return (
                <div key={pageIdx} className="print-page">
                  <div className="print-grid">
                    {pageGroup.map((r: Report, itemIdx: number) => {
                      const absIdx = pageIdx * 6 + itemIdx;
                      return (
                        <div key={r.id} style={S.reportCard} className="report-card">
                          <div style={S.reportHeader}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{r.merchant || r.site} ({r.amount}원)</p>
                              <p style={{ fontSize: '0.85rem', color: '#666', marginTop: 6, margin: '6px 0 0' }}>{r.date} · {r.name} · {r.site}</p>
                              <p style={{ fontSize: '0.85rem', color: '#007aff', marginTop: 4, fontWeight: 600, margin: '4px 0 0' }}>
                                {r.purpose}
                                {r.cardLast4 && <span style={{ color: '#888', marginLeft: 8 }}>· 법카 끝번호: {r.cardLast4}</span>}
                              </p>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#999' }}>NO. {reports.length - absIdx}</div>
                          </div>
                          {r.imageUrl && (
                            <div className="print-img-wrap">
                              <img src={r.imageUrl} alt="" className="print-img" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 기간 일괄 삭제 모달 */}
      {showDeleteModal && (
        <div style={S.modal} onClick={() => setShowDeleteModal(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>📅 기간 일괄 삭제</p>
            <p style={{ fontSize: '0.85rem', color: '#ff3b30', marginBottom: 20, lineHeight: 1.6 }}>
              ⚠️ 삭제된 데이터는 복구가 불가능합니다.<br />반드시 엑셀(EXCEL) 백업 후 진행하세요.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>이 날짜 이전 영수증을 모두 삭제</label>
              <input type="date" value={deleteBeforeDate} onChange={e => setDeleteBeforeDate(e.target.value)}
                style={S.input} />
              {deleteBeforeDate && (
                <p style={{ fontSize: '0.8rem', color: '#888', marginTop: 8 }}>
                  해당: {reports.filter(r => r.date && r.date < deleteBeforeDate).length}건
                </p>
              )}
            </div>
            <button onClick={bulkDeleteBefore} disabled={deleting}
              style={{ width: '100%', padding: 16, background: '#ff3b30', color: 'white', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: '1rem', opacity: deleting ? 0.6 : 1 }}>
              {deleting ? '삭제 중...' : '일괄 삭제 실행'}
            </button>
            <button onClick={() => setShowDeleteModal(false)}
              style={{ width: '100%', marginTop: 10, padding: 14, background: 'transparent', color: '#888', border: '1px solid #eee', borderRadius: 14 }}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* 메인 내용 (리포트 모드가 아닐 때만 표시) */}
      {!showReport && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <p style={{ padding: '4px 20px 12px', fontSize: '0.78rem', color: '#333' }}>{user.email}</p>

          {pending.length === 0 && done.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>
              <p>아직 접수된 영수증이 없습니다.</p>
            </div>
          )}

          {pending.length > 0 && (
            <>
              <p style={{ color: '#ff9500', fontWeight: 600, padding: '8px 20px 8px' }}>🔔 승인 대기 ({pending.length}건)</p>
              {pending.map(r => <ReportRow key={r.id} r={r} onClick={() => setSelected(r)} />)}
            </>
          )}

          {done.length > 0 && (
            <>
              <p style={{ color: '#333', fontWeight: 600, padding: '16px 20px 8px' }}>처리 완료 ({done.length}건)</p>
              {done.map(r => <ReportRow key={r.id} r={r} onClick={() => setSelected(r)} />)}
            </>
          )}
          <div style={{ height: 40 }} />
        </div>
      )}

      {/* 사진 전체화면 */}
      {photoFull && selected?.imageUrl && (
        <div onClick={() => setPhotoFull(false)}
          style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={selected.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          <div style={{ position: 'absolute', top: 20, right: 16, display: 'flex', gap: 10 }}>
            <button onClick={e => { e.stopPropagation(); downloadImage(selected.imageUrl); }}
              style={{ background: '#007aff', color: 'white', border: 'none', borderRadius: 40, padding: '10px 20px', fontWeight: 600 }}>
              💾 저장
            </button>
            <button onClick={() => setPhotoFull(false)}
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 40, padding: '10px 20px' }}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 상세 모달 */}
      {selected && !photoFull && (
        <div style={S.modal} onClick={() => setSelected(null)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            {selected.imageUrl ? (
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <img src={selected.imageUrl} alt=""
                  onClick={() => setPhotoFull(true)}
                  style={{ width: '100%', borderRadius: 16, maxHeight: 240, objectFit: 'cover', cursor: 'pointer' }} />
                <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 8 }}>
                  <button onClick={() => setPhotoFull(true)} style={S.photoBtn}>🔍 크게 보기</button>
                  <button onClick={() => downloadImage(selected.imageUrl)} style={{ ...S.photoBtn, background: '#007aff' }}>💾 저장</button>
                </div>
              </div>
            ) : (
              <div style={{ height: 80, background: '#1a1a1a', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', marginBottom: 16 }}>
                사진 없음
              </div>
            )}

            <div style={S.modalRow}><span style={{ color: '#aaa' }}>담당자</span><strong>{selected.name || '-'}</strong></div>
            <div style={S.modalRow}><span style={{ color: '#aaa' }}>현장</span><strong>{selected.site}</strong></div>
            <div style={S.modalRow}><span style={{ color: '#aaa' }}>날짜</span><strong>{selected.date || '-'}</strong></div>
            <div style={S.modalRow}><span style={{ color: '#aaa' }}>금액</span><strong style={{ color: '#007aff', fontSize: '1.1rem' }}>{selected.amount ? `${selected.amount}원` : '-'}</strong></div>
            <div style={S.modalRow}><span style={{ color: '#aaa' }}>항목</span><strong>{selected.purpose || '-'}</strong></div>
            <div style={S.modalRow}><span style={{ color: '#aaa' }}>사용처</span><strong>{selected.merchant || '-'}</strong></div>
            <div style={S.modalRow}><span style={{ color: '#aaa' }}>법카</span><strong>끝번호 {selected.cardLast4 || '-'}</strong></div>
            <div style={S.modalRow}><span style={{ color: '#aaa' }}>접수</span><strong>{timeAgo(selected.createdAt)}</strong></div>
            <div style={S.modalRow}>
              <span style={{ color: '#aaa' }}>상태</span>
              <strong style={{ color: selected.status === 'pending' ? '#ff9500' : selected.status === 'approved' ? '#34c759' : '#ff3b30' }}>
                {selected.status === 'pending' ? '대기중' : selected.status === 'approved' ? '✓ 승인됨' : '✗ 반려됨'}
              </strong>
            </div>

            {selected.status === 'pending' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => updateStatus(selected.id, 'rejected')}
                  style={{ flex: 1, padding: 16, background: '#ff3b3015', color: '#ff3b30', border: '1px solid #ff3b30', borderRadius: 14, fontWeight: 700, fontSize: '1rem' }}>
                  반려
                </button>
                <button onClick={() => updateStatus(selected.id, 'approved')}
                  style={{ flex: 2, padding: 16, background: '#007aff', color: 'white', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: '1rem' }}>
                  승인하기 ✓
                </button>
              </div>
            )}
            <button onClick={() => setSelected(null)}
              style={{ width: '100%', marginTop: 12, padding: 14, background: 'transparent', color: '#444', border: '1px solid #1e1e1e', borderRadius: 14 }}>
              닫기
            </button>
            <button onClick={() => deleteReport(selected.id)}
              style={{ width: '100%', marginTop: 8, padding: 14, background: 'transparent', color: '#ff3b30', border: '1px solid #ff3b3040', borderRadius: 14, fontSize: '0.9rem' }}>
              이 영수증 삭제
            </button>
          </div>
        </div>
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
      <div style={{ fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {r.merchant || r.site}
        </span>
        {r.amount && (
          <span style={{ color: '#1a1a1a', fontWeight: 700, flexShrink: 0 }}>
            {r.amount}원
          </span>
        )}
      </div>
      <div style={{ fontSize: '0.78rem', color: '#555' }}>
        {r.purpose && <span style={{ color: '#007aff', fontWeight: 600 }}>[{r.purpose}] </span>}
        {r.name} · {r.site} · {timeAgo(r.createdAt)}
      </div>
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
  const isAdmin = window.location.pathname === '/admin';
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) { setAuthLoading(false); return; }
    return onAuthStateChanged(auth, u => {
      setUser(u); setAuthLoading(false);
    });
  }, [isAdmin]);

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

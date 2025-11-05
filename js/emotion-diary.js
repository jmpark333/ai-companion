// 감정일기 관리 클래스
class EmotionDiary {
    constructor() {
        this.diaries = [];
        this.currentDiaryId = null;
        this.loadDiaries();
        this.initializeEventListeners();
    }

    // 로컬 스토리지에서 일기 불러오기
    loadDiaries() {
        const savedDiaries = localStorage.getItem('emotionDiaries');
        if (savedDiaries) {
            this.diaries = JSON.parse(savedDiaries);
        }
    }

    // 로컬 스토리지에 일기 저장
    saveDiaries() {
        localStorage.setItem('emotionDiaries', JSON.stringify(this.diaries));
    }

    // 이벤트 리스너 초기화
    initializeEventListeners() {
        // 감정일기 버튼 클릭
        const emotionDiaryBtn = document.getElementById('emotionDiaryBtn');
        if (emotionDiaryBtn) {
            emotionDiaryBtn.addEventListener('click', () => this.openDiaryModal());
        }

        // 모달 닫기 버튼들
        const closeEmotionDiary = document.getElementById('closeEmotionDiary');
        if (closeEmotionDiary) {
            closeEmotionDiary.addEventListener('click', () => this.closeDiaryModal());
        }

        const closeDiaryList = document.getElementById('closeDiaryList');
        if (closeDiaryList) {
            closeDiaryList.addEventListener('click', () => this.closeListModal());
        }

        const closeDiaryDetail = document.getElementById('closeDiaryDetail');
        if (closeDiaryDetail) {
            closeDiaryDetail.addEventListener('click', () => this.closeDetailModal());
        }

        // 오버레이 클릭시 닫기
        const emotionDiaryOverlay = document.getElementById('emotionDiaryOverlay');
        if (emotionDiaryOverlay) {
            emotionDiaryOverlay.addEventListener('click', (e) => {
                if (e.target === emotionDiaryOverlay) {
                    this.closeDiaryModal();
                }
            });
        }

        const diaryListOverlay = document.getElementById('diaryListOverlay');
        if (diaryListOverlay) {
            diaryListOverlay.addEventListener('click', (e) => {
                if (e.target === diaryListOverlay) {
                    this.closeListModal();
                }
            });
        }

        const diaryDetailOverlay = document.getElementById('diaryDetailOverlay');
        if (diaryDetailOverlay) {
            diaryDetailOverlay.addEventListener('click', (e) => {
                if (e.target === diaryDetailOverlay) {
                    this.closeDetailModal();
                }
            });
        }

        // 일기 저장 버튼
        const saveDiaryBtn = document.getElementById('saveDiary');
        if (saveDiaryBtn) {
            saveDiaryBtn.addEventListener('click', () => this.saveDiary());
        }

        // 일기 목록 보기 버튼
        const viewDiaryListBtn = document.getElementById('viewDiaryList');
        if (viewDiaryListBtn) {
            viewDiaryListBtn.addEventListener('click', () => this.showDiaryList());
        }

        // 새 일기 작성 버튼
        const backToNewDiaryBtn = document.getElementById('backToNewDiary');
        if (backToNewDiaryBtn) {
            backToNewDiaryBtn.addEventListener('click', () => {
                this.closeListModal();
                this.openDiaryModal();
            });
        }

        // 목록으로 돌아가기 버튼
        const backToDiaryListBtn = document.getElementById('backToDiaryList');
        if (backToDiaryListBtn) {
            backToDiaryListBtn.addEventListener('click', () => {
                this.closeDetailModal();
                this.showDiaryList();
            });
        }

        // 일기 삭제 버튼
        const deleteDiaryBtn = document.getElementById('deleteDiary');
        if (deleteDiaryBtn) {
            deleteDiaryBtn.addEventListener('click', () => this.deleteDiary());
        }

        // 태그 버튼들
        const tagButtons = document.querySelectorAll('.tag-btn');
        tagButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                btn.classList.toggle('active');
            });
        });

        // 검색 및 필터링
        const diarySearchInput = document.getElementById('diarySearchInput');
        if (diarySearchInput) {
            diarySearchInput.addEventListener('input', () => this.filterDiaries());
        }

        const diaryTagFilter = document.getElementById('diaryTagFilter');
        if (diaryTagFilter) {
            diaryTagFilter.addEventListener('change', () => this.filterDiaries());
        }
    }

    // 감정일기 작성 모달 열기
    openDiaryModal() {
        this.resetForm();
        const overlay = document.getElementById('emotionDiaryOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            setTimeout(() => {
                overlay.classList.add('active');
            }, 10);
        }
    }

    // 감정일기 모달 닫기
    closeDiaryModal() {
        const overlay = document.getElementById('emotionDiaryOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    }

    // 일기 목록 모달 열기
    showDiaryList() {
        this.closeDiaryModal();
        this.closeDetailModal();

        this.renderDiaryList();

        const overlay = document.getElementById('diaryListOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            setTimeout(() => {
                overlay.classList.add('active');
            }, 10);
        }
    }

    // 일기 목록 모달 닫기
    closeListModal() {
        const overlay = document.getElementById('diaryListOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    }

    // 일기 상세보기 모달 열기
    showDiaryDetail(diaryId) {
        this.currentDiaryId = diaryId;
        const diary = this.diaries.find(d => d.id === diaryId);

        if (!diary) return;

        this.closeListModal();

        const detailContent = document.getElementById('diaryDetailContent');
        if (detailContent) {
            detailContent.innerHTML = `
                <div class="diary-detail-section">
                    <span class="diary-detail-label">
                        <span class="emoji">💭</span>
                        감정적으로 흔들렸던 순간 나의 마음
                    </span>
                    <div class="diary-detail-content">${this.escapeHtml(diary.emotionalMoment)}</div>
                </div>

                <div class="diary-detail-section">
                    <span class="diary-detail-label">
                        <span class="emoji">🔍</span>
                        감정의 원인을 탐구하기
                    </span>
                    <div class="diary-detail-content">${this.escapeHtml(diary.emotionCause)}</div>
                </div>

                <div class="diary-detail-section">
                    <span class="diary-detail-label">
                        <span class="emoji">🌿</span>
                        감정을 다루기 위해 대처한 방법
                    </span>
                    <div class="diary-detail-content">${this.escapeHtml(diary.copingMethod)}</div>
                </div>

                <div class="diary-detail-section">
                    <span class="diary-detail-label">
                        <span class="emoji">💝</span>
                        따뜻한 자기 위로
                    </span>
                    <div class="diary-detail-content">${this.escapeHtml(diary.selfComfort)}</div>
                </div>

                ${diary.tags && diary.tags.length > 0 ? `
                <div class="diary-detail-section">
                    <span class="diary-detail-label">
                        <span class="emoji">🏷️</span>
                        감정 태그
                    </span>
                    <div class="diary-item-tags">
                        ${diary.tags.map(tag => `<span class="diary-tag">${tag}</span>`).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="diary-detail-date">
                    작성일: ${this.formatDate(diary.createdAt)}
                </div>
            `;
        }

        const overlay = document.getElementById('diaryDetailOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            setTimeout(() => {
                overlay.classList.add('active');
            }, 10);
        }
    }

    // 일기 상세보기 모달 닫기
    closeDetailModal() {
        const overlay = document.getElementById('diaryDetailOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
        this.currentDiaryId = null;
    }

    // 폼 초기화
    resetForm() {
        document.getElementById('emotionalMoment').value = '';
        document.getElementById('emotionCause').value = '';
        document.getElementById('copingMethod').value = '';
        document.getElementById('selfComfort').value = '';

        const tagButtons = document.querySelectorAll('.tag-btn');
        tagButtons.forEach(btn => btn.classList.remove('active'));
    }

    // 일기 저장
    saveDiary() {
        const emotionalMoment = document.getElementById('emotionalMoment').value.trim();
        const emotionCause = document.getElementById('emotionCause').value.trim();
        const copingMethod = document.getElementById('copingMethod').value.trim();
        const selfComfort = document.getElementById('selfComfort').value.trim();

        // 최소 하나 이상의 항목이 작성되어야 함
        if (!emotionalMoment && !emotionCause && !copingMethod && !selfComfort) {
            alert('최소 한 항목 이상 작성해주세요.');
            return;
        }

        // 선택된 태그 가져오기
        const selectedTags = Array.from(document.querySelectorAll('.tag-btn.active'))
            .map(btn => btn.dataset.tag);

        const diary = {
            id: Date.now(),
            emotionalMoment,
            emotionCause,
            copingMethod,
            selfComfort,
            tags: selectedTags,
            createdAt: new Date().toISOString()
        };

        this.diaries.unshift(diary); // 최신 일기를 맨 앞에 추가
        this.saveDiaries();

        alert('✅ 감정 일기가 저장되었습니다.');
        this.closeDiaryModal();
    }

    // 일기 삭제
    deleteDiary() {
        if (!this.currentDiaryId) return;

        if (confirm('정말 이 일기를 삭제하시겠습니까?')) {
            this.diaries = this.diaries.filter(d => d.id !== this.currentDiaryId);
            this.saveDiaries();

            alert('🗑️ 일기가 삭제되었습니다.');
            this.closeDetailModal();
            this.showDiaryList();
        }
    }

    // 일기 목록 렌더링
    renderDiaryList(filteredDiaries = null) {
        const container = document.getElementById('diaryListContainer');
        if (!container) return;

        const diariesToShow = filteredDiaries !== null ? filteredDiaries : this.diaries;

        if (diariesToShow.length === 0) {
            container.innerHTML = `
                <div class="diary-empty">
                    <div class="diary-empty-icon">📝</div>
                    <p>아직 작성된 감정 일기가 없습니다.</p>
                    <p style="font-size: 14px; color: #999;">첫 번째 감정 일기를 작성해보세요!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = diariesToShow.map(diary => {
            const preview = this.createPreview(diary);
            return `
                <div class="diary-item" data-diary-id="${diary.id}">
                    <div class="diary-item-header">
                        <span class="diary-item-date">${this.formatDate(diary.createdAt)}</span>
                        ${diary.tags && diary.tags.length > 0 ? `
                        <div class="diary-item-tags">
                            ${diary.tags.map(tag => `<span class="diary-tag">${tag}</span>`).join('')}
                        </div>
                        ` : ''}
                    </div>
                    <div class="diary-item-preview">${this.escapeHtml(preview)}</div>
                </div>
            `;
        }).join('');

        // 일기 항목 클릭 이벤트 추가
        container.querySelectorAll('.diary-item').forEach(item => {
            item.addEventListener('click', () => {
                const diaryId = parseInt(item.dataset.diaryId);
                this.showDiaryDetail(diaryId);
            });
        });
    }

    // 일기 미리보기 생성
    createPreview(diary) {
        const parts = [];
        if (diary.emotionalMoment) parts.push(diary.emotionalMoment);
        if (diary.emotionCause) parts.push(diary.emotionCause);
        if (diary.copingMethod) parts.push(diary.copingMethod);
        if (diary.selfComfort) parts.push(diary.selfComfort);

        const preview = parts.join(' | ');
        return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
    }

    // 일기 필터링
    filterDiaries() {
        const searchTerm = document.getElementById('diarySearchInput').value.toLowerCase().trim();
        const selectedTag = document.getElementById('diaryTagFilter').value;

        let filtered = this.diaries;

        // 태그 필터링
        if (selectedTag) {
            filtered = filtered.filter(diary =>
                diary.tags && diary.tags.includes(selectedTag)
            );
        }

        // 검색어 필터링
        if (searchTerm) {
            filtered = filtered.filter(diary => {
                const searchFields = [
                    diary.emotionalMoment,
                    diary.emotionCause,
                    diary.copingMethod,
                    diary.selfComfort,
                    diary.tags ? diary.tags.join(' ') : ''
                ].join(' ').toLowerCase();

                return searchFields.includes(searchTerm);
            });
        }

        this.renderDiaryList(filtered);
    }

    // 날짜 포맷팅
    formatDate(dateString) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}`;
    }

    // HTML 이스케이프
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 전체 일기 삭제 (설정에서 호출 가능)
    clearAllDiaries() {
        if (confirm('정말 모든 감정 일기를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
            this.diaries = [];
            this.saveDiaries();
            alert('모든 감정 일기가 삭제되었습니다.');
            this.renderDiaryList();
        }
    }

    // 일기 개수 가져오기
    getDiaryCount() {
        return this.diaries.length;
    }

    // 일기 통계
    getStatistics() {
        const tagCounts = {};
        this.diaries.forEach(diary => {
            if (diary.tags) {
                diary.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });

        return {
            totalDiaries: this.diaries.length,
            tagCounts,
            mostUsedTag: Object.keys(tagCounts).reduce((a, b) =>
                tagCounts[a] > tagCounts[b] ? a : b, null
            ),
            oldestDiary: this.diaries.length > 0 ?
                this.diaries[this.diaries.length - 1].createdAt : null,
            newestDiary: this.diaries.length > 0 ?
                this.diaries[0].createdAt : null
        };
    }
}

// 전역으로 인스턴스 생성
if (typeof window !== 'undefined') {
    window.emotionDiary = new EmotionDiary();
}

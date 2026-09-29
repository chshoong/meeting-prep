---
layout: title
title: 모듈 B Ablation 결과
subtitle: 주간 연구 미팅
date: 2026-10-06
author: 홍길동
notes: 오늘은 모듈 B 위주로 말씀드림
---
---
layout: checklist
title: 지난 피드백 반영 현황
items:
  - status: done
    text: "#1 베이스라인 추가"
    note: 3종 추가 완료
  - status: doing
    text: "#2 데이터셋 B 실험"
  - status: todo
    text: "#3 관련 연구 정리"
    note: 다음 주 진행
---
---
layout: bullets
title: 이번 주 한 일
notes: 핵심은 두 번째 항목
---
- 베이스라인 3종 재실험 (seed 5개)
  - **Ours 72.4** vs Baseline 68.1
- 데이터셋 B에서 OOM 발생 → 배치 축소
---
layout: figure
title: 모듈 B 제거 시 성능 변화
image: assets/plot.png
caption: seed 5개 평균
---
---
layout: two-column
title: 가설 비교
leftTitle: 가설 1
rightTitle: 가설 2
left: |
  - 초기 토큰 의존
  - 길이에 민감
right: |
  - 정규화 문제
  - p<0.05 & 유의
---
---
layout: table
title: 결과 요약
columns: [모델, 정확도, 비고]
rows:
  - [Baseline, "68.1", 기존]
  - [Ours, "72.4", "+4.3"]
---
---
layout: compare
title: 전후 비교
left:
  label: 이전
  points: [느림, 메모리 많음]
right:
  label: 이후
  image: assets/plot.png
---

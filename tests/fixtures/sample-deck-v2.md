---
deck:
  brand: KAMP PROJECT
  author: 홍길동
  affiliation: 테스트대학교 통계학과
  date: 2026-10-06
---
---
layout: title
kicker: KAMP 제조 AI 데이터셋 · 주간 프로젝트 미팅
title: "**불량 예측 모델**의 선정과 테스트 성능"
question: CV로 고른 구성은 테스트에서도 좋았을까?
notes: 표지
---
---
layout: section
number: "01"
title: 주요 결과
subtitle: 선정 모델과 베이스라인 비교
---
---
layout: chart
title: 선정 모델이 **테스트 AP**에서 앞섰다
subtitle: 5-fold CV로 고른 구성을 2025년 테스트셋에 적용
takeaway: "**CV에서 좋은 구성**이 ==테스트에서도== 좋다는 보장은 없었다"
chart:
  type: bar
  title: 제품별 Test AP
  data: assets/metrics.csv
  x: product
  y: [baseline_ap, selected_ap]
  names: [베이스라인, 선정 모델]
kpis:
  - { label: Test AP 평균 향상, value: "+0.07", delta: "21%" }
  - { label: Test AUC (CN7), value: "0.91", delta: "+0.02" }
  - { label: 오탐(FP) 수, value: "84", delta: "-18%", good: down }
notes: 결과 요약
---
---
layout: stats
section: 주요 결과
title: 핵심 수치
kpis:
  - { label: Test AP, value: "0.43", delta: "+0.06" }
  - { label: Test AUC, value: "0.91", delta: "+0.02" }
  - { label: FP, value: "84", delta: "-18%", good: down }
---
---
layout: cards
section: 프로젝트 전체 구조
title: 분석 **파이프라인** 요약
flow: true
takeaway: 고차원 공정 변수를 **불량 확률 하나**로 요약
cards:
  - title: Data Audit
    items: [CN7 · RG3 공식 파일 점검, 열별 평균 0 · 표준편차 1 확인]
  - title: Model Selection
    items: [LightGBM · Random Forest, 5-fold CV]
  - title: Evaluation
    color: green
    items: [2025년 테스트셋, AP · AUC · TP/FP]
---
---
layout: figure
title: CV AP와 Test AP의 관계
image: assets/plot.png
caption: 점 하나 = 하이퍼파라미터 구성 하나
note: 상관이 거의 없다
---
---
layout: table
title: 결과 요약
columns: [모델, CV AP, Test AP, 비고]
rows:
  - [Baseline, "0.41", "0.37", 기존]
  - [Selected, "0.46", "0.43", "p<0.05 & 유의"]
highlight: [2]
---
---
layout: checklist
section: 지난 미팅 피드백
title: 지난 피드백 **반영 현황**
items:
  - { status: done, text: "#1 베이스라인 추가", note: LightGBM 기본값 }
  - { status: doing, text: "#2 오류 분석", note: FP 사례 분류 중 }
  - { status: todo, text: "#3 현장 활용안" }
---
---
layout: compare
title: 전후 비교
left:
  label: 이전
  items: [느림, 메모리 많음]
right:
  label: 이후
  kpis:
    - { label: 학습 시간, value: 12분, delta: "-40%", good: down }
---
---
layout: bullets
title: 다음 계획
---
- 오류 분석 마무리
  - FP 사례 유형 분류
- 현장 활용안 초안

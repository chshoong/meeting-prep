---
report:
  kicker: KAMP 제조 AI · 프로젝트 보고서
  title: 불량 예측 모델 비교
  subtitle: 5-fold CV로 고른 구성의 테스트 성능
  pills: [2022–2024 학습, 2025 평가, 조건별 3회 반복]
datasets:
  runs:
    file: assets/results.csv
    dims: [method, scenario]
    metrics:
      ap: { label: Test AP, decimals: 3, better: up }
      fp: { label: 오탐 수, decimals: 0, better: down }
---
---
tab: goal
title: 목표
---
---
section: 무엇을 비교하나?
kicker: RESEARCH QUESTION
cycle: 2026-09-22
---
---
component: text
---
두 방법을 **같은 조건**에서 비교한다. ==테스트셋==은 평가에만 썼다.

- 방법 A: 로지스틱 회귀
- 방법 B: LightGBM
---
component: stats
items:
  - { label: 학습 행 수, value: "48,210", note: 2022~2024 }
  - { label: 반복, value: 3회 }
---
---
component: callout
tone: warn
---
독립된 새 시험자료로 검증한 결과는 **아닙니다**.
---
tab: method
title: 방법
---
---
section: 파이프라인
cycle: 2026-09-22
---
---
component: steps
items:
  - { title: 데이터 점검, text: 공식 파일 스케일링 확인 }
  - { title: 모델 선택, text: 5-fold CV }
---
---
component: details
title: 데이터 출처
---
`assets/results.csv` 12행. 원본과 행 수 일치.
---
component: custom
---
<svg viewBox="0 0 100 20" class="diagram"><rect x="0" y="0" width="100" height="20" fill="var(--tint)"/></svg>
<script>el.querySelector('svg').setAttribute('data-ok', '1');</script>
---
tab: results
title: 결과
---
---
section: 방법별 Test AP
cycle: 2026-10-06
---
---
component: filter
dataset: runs
dims: [scenario]
---
---
component: chart
type: bar
title: 시나리오별 Test AP
from: { dataset: runs, x: scenario, y: [ap], by: method }
---
---
component: table
from: { dataset: runs, x: method, y: [ap, fp], show: [mean, sd] }
---
---
component: compare
dataset: runs
metrics: [ap, fp]
a: { method: A, scenario: S1 }
b: { method: B, scenario: S1 }
presets:
  - { label: S2 비교, a: { method: A, scenario: S2 }, b: { method: B, scenario: S2 } }
---
---
section: 예전 결과
cycle: 2026-09-22
archived: true
---
---
component: text
---
이전 버전의 결과.

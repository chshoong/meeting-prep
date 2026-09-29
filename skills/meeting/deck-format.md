# deck.md 작성 규칙

`deck.md`는 슬라이드의 연속이다. 각 슬라이드는 `---`로 둘러싼 YAML 머리말로 시작하고, `bullets`만 닫는 `---` 아래에 본문을 쓴다. 본문이 없는 슬라이드는 닫는 `---` 바로 다음 줄에 다음 슬라이드의 여는 `---`가 온다.

```
---
layout: title
title: 제목
---
---
layout: bullets
title: 글머리표 슬라이드
---
- 첫 항목
  - 들여쓴 항목 (공백 2칸)
---
layout: figure
...
```

## 공통 필드

- `layout` (필수): 아래 7종 중 하나
- `title` (필수)
- `notes` (선택): 발표자 노트. 교수님께 말로 설명할 내용

## 레이아웃

| layout | 필드 | 쓰는 곳 |
|---|---|---|
| `title` | `subtitle`, `date`, `author` | 표지 |
| `bullets` | 본문(닫는 `---` 아래, `- ` 목록) | 한 일, 다음 계획, 논의할 점 |
| `figure` | `image`(필수), `caption` | 그래프, 결과 그림, 데모 스크린샷 |
| `two-column` | `leftTitle`, `rightTitle`, `left`, `right`(필수, `\|` 블록 문자열 목록) | 가설 비교, 장단점 |
| `table` | `columns`(필수 목록), `rows`(필수, 각 행의 칸 수 = columns 수) | 수치 비교, 일정표 |
| `checklist` | `items`(필수): `status`(`done`/`doing`/`todo`), `text`, `note` | 지난 피드백 반영 현황, 마일스톤 |
| `compare` | `left`, `right`: 각각 `label`(필수)과 `image` 또는 `points` 목록 | 전/후, A vs B |

## 예시

```
---
layout: checklist
title: 지난 피드백 반영 현황
items:
  - status: done
    text: "#1 베이스라인 추가"
    note: 3종 추가 완료
  - status: todo
    text: "#2 관련 연구 정리"
    note: 다음 주 진행
---
---
layout: figure
title: 모듈 B 제거 시 성능 변화
image: assets/ablation.png
caption: seed 5개 평균
notes: 데이터셋 B에서 하락 폭이 가장 큼
---
---
layout: two-column
title: 원인 가설
leftTitle: 가설 1
rightTitle: 가설 2
left: |
  - 초기 토큰 의존
right: |
  - 정규화 문제
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
title: 구조 변경 전후
left:
  label: 이전
  points: [느림, 메모리 많음]
right:
  label: 이후
  image: assets/after.png
---
```

## 주의

- `#`로 시작하는 값, `:`가 들어간 값, 숫자처럼 보이는 문자열(`"68.1"`, `"+4.3"`)은 큰따옴표로 감싼다.
- 본문 안에 `---`만 있는 줄을 쓰지 않는다 (슬라이드 구분자로 읽힌다).
- `**굵게**`만 지원한다. 다른 마크다운 서식은 글자 그대로 나온다.
- 그림은 png, jpg, gif만 된다. `image`는 `deck.md` 기준 상대 경로(`assets/...`)로 쓴다.
- 글머리표 슬라이드는 항목 7개 안팎, 한 항목은 한 줄 안팎이 적당하다. 넘치면 렌더러가 경고한다.

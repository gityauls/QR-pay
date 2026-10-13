# CLAUDE.md — 프로젝트 지침

> Claude Code가 자동 생성한 템플릿입니다.
> "이 프로젝트에 맞게 CLAUDE.md를 작성해줘" 라고 요청하면 Claude가 채워줍니다.

## 프로젝트 개요
(프로젝트 설명을 작성하세요)

## 파일 구조
| 파일 | 역할 |
|------|------|
| `main.py` | 메인 파일 |

## 실행 방법
```bash
python main.py
```

## 핵심 원칙
(프로젝트 규칙을 작성하세요)

## Token Optimization Rules
1. Trust files already read — do not re-read unless changed
2. No speculative tool calls — only read what's actually needed
3. Parallelize independent tool calls in a single message
4. Route output > 20 lines to subagents
5. Never restate what the user already said

## 세션 관리
- 작업 중간 (같은 작업 이어서): /compact
- 작업 전환 (새 작업 시작): /clear

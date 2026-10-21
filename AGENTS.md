# 이력서 및 경력기술서 변경 규칙

- **이력서**:
  - `index.html`이 원본이다. 결과 PDF는 `AI Agent Developer 황화인 이력서.pdf`다.
  - 원본을 수정하면 `npm run resume:pdf`로 PDF를 갱신하고 내용과 4쪽 A4 출력을 확인한다.
  - HTML, PDF, `.resume-build.json`과 관련 변경을 같은 커밋에 기록한다.
- **경력기술서**:
  - `output/경력기술서/career_description_draft.md`가 원본이다. 결과 PDF는 `output/경력기술서/AI Agent Developer 황화인 경력기술서.pdf`다.
  - 원본을 수정하면 `npm run career:pdf`로 PDF를 갱신하고 내용과 9쪽 A4 출력을 확인한다.
  - MD, PDF, `output/경력기술서/.career-build.json`과 관련 변경을 같은 커밋에 기록한다.
- **통합 가드 및 검사**:
  - `npm run pdf:all`은 이력서와 경력기술서 PDF를 모두 갱신한다.
  - `npm run lint`는 이력서/경력기술서 PDF의 원본 일치 및 관련 파일의 커밋 완료를 확인한다. 작업 중 PDF만 확인할 때는 `node scripts/resume-guard.mjs check-pdf`를 사용한다.
  - `git commit` 시 `pre-commit` 훅이 스테이징된 변경(HTML 또는 MD)을 감지해 해당하는 PDF와 영수증을 자동 빌드 및 `git add`하여 원자적 커밋으로 보존한다.
  - `git push` 전에는 PDF와 커밋 검사를 통과해야 한다. push는 사용자가 요청한 범위에서만 실행한다.
  - 처음 설치하거나 다른 PC에서 사용할 때는 `npm install` 후 `npm run hooks:install`을 실행한다. Chrome이 설치되어 있어야 한다.
  - 훅 우회 옵션을 사용해 검사 실패를 숨기지 않는다. 실패 원인을 수정하고 다시 검사한다.

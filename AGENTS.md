# 이력서 변경 규칙

- `index.html`이 이력서의 원본이다. 결과 PDF는 `AI Agent Developer 황화인 이력서.pdf`다.
- 원본을 수정하면 `npm run resume:pdf`로 PDF를 갱신하고 내용과 4쪽 A4 출력을 확인한다.
- HTML, PDF, `.resume-build.json`과 관련 변경을 같은 커밋에 기록한다. 이력서 변경을 커밋하지 않고 작업 완료로 보고하지 않는다.
- `npm run lint`는 PDF의 원본 일치 및 이력서 관련 파일의 커밋 완료를 확인한다. 작업 중 PDF만 확인할 때는 `node scripts/resume-guard.mjs check-pdf`를 사용한다.
- `git push` 전에는 PDF와 커밋 검사를 통과해야 한다. push는 사용자가 요청한 범위에서만 실행한다.
- 처음 설치하거나 다른 PC에서 사용할 때는 `npm install` 후 `npm run hooks:install`을 실행한다. Chrome이 설치되어 있어야 한다.
- Codex의 프로젝트 훅은 `/hooks`에서 현재 정의를 검토하고 신뢰해야 실행된다. Claude는 프로젝트 세션을 다시 열어 훅을 로드한다.
- 훅 우회 옵션을 사용해 검사 실패를 숨기지 않는다. 실패 원인을 수정하고 다시 검사한다.

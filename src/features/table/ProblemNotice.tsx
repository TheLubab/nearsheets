import type { Problem } from './problems';

export function ProblemNotice({problem}:{problem:Problem}) {
  return <section role="alert">
    <p><strong>{problem.title}</strong></p>
    <p>{problem.message}</p><p>{problem.recovery}</p>
    {problem.details && <details><summary>Technical details</summary><pre>{problem.details}</pre></details>}
  </section>;
}

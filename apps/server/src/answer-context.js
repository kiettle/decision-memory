// Resolve recorded lifecycle links, never infer a winning choice from rank or prose.
export async function answerContext(repository, identity, ids, scope) {
  const records = await Promise.all([...new Set(ids)].slice(0, 5).map(id => repository.getDecision(identity, id)))
  const decisions = records.filter(Boolean)
  const currentIds = [...new Set(decisions.flatMap(d => d.lifecycle?.current?.map(item => item.id) ?? []))].filter(id => !decisions.some(d => d.id === id))
  const successors = await Promise.all(currentIds.slice(0, 10).map(id => repository.getDecision(identity, id)))
  const all = [...decisions, ...successors.filter(Boolean)]
  all.sort((a, b) => Number(b.status === "ACTIVE" && (!scope || b.appliesTo.includes(scope))) - Number(a.status === "ACTIVE" && (!scope || a.appliesTo.includes(scope))))
  return { decisions: all, omittedSuccessors: Math.max(0, currentIds.length - 10), scope: scope ?? null }
}

import re

with open("frontend/src/components/legacy/ApplicationForm.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# Remove SourceTag interface
code = re.sub(r"interface SourceTag \{.*?\}", "", code, flags=re.DOTALL)
# Remove TYPING_DELAY_MS and typeValue function
code = re.sub(r"const TYPING_DELAY_MS = 60.*?async function typeValue.*?\}\n\n", "", code, flags=re.DOTALL)
# Remove demoSteps and sourceTags state
code = re.sub(r"  const demoSteps = useR4miStore\(\(s\) => s.demoSteps\)\n", "", code)
code = re.sub(r"  const \[sourceTags, setSourceTags\] = useState<SourceTag\[\]>\(\[\]\)\n", "", code)
code = re.sub(r"  const processedCountRef = \{ current: 0 \}\n", "", code)
# Remove state resets
code = re.sub(r"    setSourceTags\(\[\]\)\n", "", code)
code = re.sub(r"    processedCountRef\.current = 0\n", "", code)
# Remove useEffects for r4mi:demo-step and applyAll
code = re.sub(r"  // Listen for HITL replay steps.*?  \}, \[\]\)\n", "", code, flags=re.DOTALL)
code = re.sub(r"  // Apply demo step auto-fill.*?  \}, \[demoSteps\]\)\n", "", code, flags=re.DOTALL)
# Remove getSourceTag function
code = re.sub(r"  function getSourceTag.*?\}\n", "", code, flags=re.DOTALL)
# Remove sourceTag prop from FormRow usages
code = re.sub(r"\s*sourceTag=\{getSourceTag\('[^']+'\)\}", "", code)
# Remove SourceTagBadge usages in form elements directly
code = re.sub(r"\{getSourceTag\('notes'\) && <SourceTagBadge tag=\{getSourceTag\('notes'\)!\} />\}", "", code)
# Remove testId props from FormRow
code = re.sub(r"\s*testId=\"[^\"]+\"", "", code)
# Remove SourceTagBadge definition
code = re.sub(r"function SourceTagBadge.*?\}\n", "", code, flags=re.DOTALL)
# Clean up FormRow props
code = re.sub(r",\s*sourceTag,\s*testId", "", code)
code = re.sub(r"\s*sourceTag\?: \{ field: string; value: string; source: string \}\n\s*testId\?: string", "", code)
# Remove SourceTagBadge from FormRow body
code = re.sub(r"\{sourceTag && <SourceTagBadge tag=\{sourceTag\} />\}", "", code)
# Remove data-testid from inputs
code = re.sub(r"\s*data-testid=\{testId\}", "", code)

with open("frontend/src/components/legacy/ApplicationForm.tsx", "w", encoding="utf-8") as f:
    f.write(code)

print("done")

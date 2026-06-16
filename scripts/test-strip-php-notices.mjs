// Test stripPhpNotices with the actual Air Intra response format from the user's error
// Simulates a response with PHP notices INSIDE JSON objects (the real-world scenario)

function stripPhpNotices(text) {
  let cleaned = text
    .replace(/<\/?b>/gi, '')
    .replace(/<br\s*\/?>\s*/gi, '')
    .replace(/(?:Notice|Warning|Fatal error|Parse error|Deprecated):\s*.*?on line\s+\d+\s*/gis, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/}\s*{/g, '},{')
    .replace(/,\s*,/g, ',')
  return cleaned.trim()
}

// Simulated Air Intra response: PHP notices BEFORE the array AND INSIDE objects
const rawResponse = `<br /> <b>Notice</b>:  Undefined property: stdClass::$estado in <b>/home/uairintra/domains/air-intra.com/public_html/api/v2/consulta.php</b> on line <b>54</b><br /> <br /> <b>Notice</b>:  Undefined property: stdClass::$codiart in <b>/home/uairintra/domains/air-intra.com/public_html/api/v2/consulta.php</b> on line <b>98</b><br /> <br /> <b>Notice</b>:  Undefined property: stdClass::$rubro in <b>/home/uairintra/domains/air-intra.com/public_html/api/v2/consulta.php</b> on line <b>101</b><br /> [{"codigo":"ABC123","descrip":"Notebook Lenovo","estado":<br /><b>Notice</b>:  Undefined property: stdClass::$estado in <b>/home/uairintra/domains/air-intra.com/public_html/api/v2/consulta.php</b> on line <b>54</b><br />null,"codiart":<br /><b>Notice</b>:  Undefined property: stdClass::$codiart in <b>/home/uairintra/domains/air-intra.com/public_html/api/v2/consulta.php</b> on line <b>98</b><br />"ABC123","rubro":<br /><b>Notice</b>:  Undefined property: stdClass::$rubro in <b>/home/uairintra/domains/air-intra.com/public_html/api/v2/consulta.php</b> on line <b>101</b><br />"Computacion","precio":"1000"},{"codigo":"DEF456","descrip":"Monitor LG","estado":null,"codiart":"DEF456","rubro":"Monitores","precio":"500"}]`

console.log('=== RAW RESPONSE (first 300 chars) ===')
console.log(rawResponse.substring(0, 300))
console.log(`\nRaw length: ${rawResponse.length} chars\n`)

const cleaned = stripPhpNotices(rawResponse)
console.log('=== AFTER stripPhpNotices ===')
console.log(cleaned.substring(0, 500))
console.log(`\nCleaned length: ${cleaned.length} chars\n`)

// Try to parse
try {
  const data = JSON.parse(cleaned)
  console.log('=== JSON.parse SUCCESS ===')
  console.log(`Products found: ${data.length}`)
  for (const p of data) {
    console.log(`  - ${p.codigo}: ${p.descrip} ($${p.precio})`)
  }
} catch (err) {
  console.log('=== JSON.parse FAILED ===')
  console.log(`Error: ${err.message}`)
  
  // Try to find the error position
  const posMatch = err.message.match(/position\s+(\d+)/i)
  if (posMatch) {
    const pos = parseInt(posMatch[1])
    console.log(`Context around position ${pos}:`)
    console.log(`  ...${cleaned.substring(Math.max(0, pos - 50), pos + 50)}...`)
  }
}

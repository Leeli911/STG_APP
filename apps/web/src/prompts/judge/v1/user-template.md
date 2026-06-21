Judge the following STG output.

Original Question:

{{question}}

Original User Answer:

{{user\_answer}}

Target Schema:

{{target\_schema\_name}}

Output To Judge:

{{output\_json}}

Return only JSON in this schema:

{

"result": "pass | fail",

"overall\_reason": "string",

"checks": {

"valid\_json": {

"pass": true,

"reason": "string"

},

"schema\_compliance": {

"pass": true,

"reason": "string"

},

"score\_consistency": {

"pass": true,

"reason": "string"

},

"rubric\_alignment": {

"pass": true,

"reason": "string"

},

"diagnosis\_specificity": {

"pass": true,

"reason": "string"

},

"rewrite\_quality": {

"pass": true,

"reason": "string"

},

"fact\_preservation": {

"pass": true,

"reason": "string"

},

"teaching\_usefulness": {

"pass": true,

"reason": "string"

},

"frontend\_readiness": {

"pass": true,

"reason": "string"

}

},

"failure\_items": [

{

"severity": "critical | major | minor",

"location": "string",

"problem": "string",

"repair\_hint": "string"

}

],

"recommended\_action": "accept | repair | regenerate"

}

#!/usr/bin/env pwsh
# Test add_route.cjs with predefined inputs

$inputs = @(
    'm_demo',           # API endpoint
    '/setup/m_demo',    # Route path
    'n'                 # No detail items
)

$inputString = $inputs -join "`n"

# Run the script with piped input
$inputString | node add_route.cjs setup/m_demo

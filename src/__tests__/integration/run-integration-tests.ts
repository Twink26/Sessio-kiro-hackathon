#!/usr/bin/env node

/**
 * Integration test runner for Session Recap Extension
 * 
 * This script runs comprehensive integration tests that verify:
 * - Complete session lifecycle workflows
 * - VS Code API integration
 * - Webview communication
 * - Configuration changes and effects
 * 
 * Usage:
 *   npm run test:integration
 *   node src/__tests__/integration/run-integration-tests.ts
 */

import { execSync } from 'child_process';
import * as path from 'path';

interface TestSuite {
    name: string;
    file: string;
    description: string;
}

const testSuites: TestSuite[] = [
    {
        name: 'Full Workflow',
        file: 'full-workflow.test.ts',
        description: 'End-to-end session lifecycle and complete workflows'
    },
    {
        name: 'VS Code API Integration',
        file: 'vscode-api-integration.test.ts',
        description: 'File system, Git, terminal, and workspace API integration'
    },
    {
        name: 'Configuration Integration',
        file: 'configuration-integration.test.ts',
        description: 'Configuration changes and their effects on extension behavior'
    },
    {
        name: 'Webview Communication',
        file: 'webview-communication.test.ts',
        description: 'Webview panel creation, communication, and user interactions'
    }
];

async function runIntegrationTests() {
    console.log('🚀 Starting Session Recap Extension Integration Tests\n');
    
    const startTime = Date.now();
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    const failedSuites: string[] = [];

    for (const suite of testSuites) {
        console.log(`📋 Running ${suite.name} Tests`);
        console.log(`   ${suite.description}`);
        
        try {
            const testFile = path.join(__dirname, suite.file);
            const result = execSync(
                `npx jest "${testFile}" --verbose --no-coverage --testTimeout=60000`,
                { 
                    encoding: 'utf8',
                    stdio: 'pipe'
                }
            );
            
            // Parse Jest output to count tests
            const testMatches = result.match(/✓|✗/g);
            const suiteTests = testMatches ? testMatches.length : 0;
            const suitePassed = (result.match(/✓/g) || []).length;
            const suiteFailed = (result.match(/✗/g) || []).length;
            
            totalTests += suiteTests;
            passedTests += suitePassed;
            failedTests += suiteFailed;
            
            console.log(`   ✅ ${suite.name}: ${suitePassed}/${suiteTests} tests passed\n`);
            
        } catch (error: any) {
            console.log(`   ❌ ${suite.name}: Tests failed`);
            console.log(`   Error: ${error.message}\n`);
            failedSuites.push(suite.name);
            failedTests++;
        }
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('📊 Integration Test Summary');
    console.log('=' .repeat(50));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Duration: ${duration}s`);
    
    if (failedSuites.length > 0) {
        console.log(`\n❌ Failed Test Suites:`);
        failedSuites.forEach(suite => console.log(`   - ${suite}`));
    }
    
    if (failedTests === 0) {
        console.log('\n🎉 All integration tests passed!');
        process.exit(0);
    } else {
        console.log('\n💥 Some integration tests failed.');
        process.exit(1);
    }
}

// Test coverage requirements for integration tests
const coverageRequirements = {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80
};

async function checkCoverage() {
    console.log('\n📈 Checking Integration Test Coverage...');
    
    try {
        const result = execSync(
            'npx jest src/__tests__/integration --coverage --coverageReporters=text-summary',
            { encoding: 'utf8', stdio: 'pipe' }
        );
        
        console.log(result);
        
        // Parse coverage results
        const coverageMatch = result.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
        
        if (coverageMatch) {
            const [, statements, branches, functions, lines] = coverageMatch;
            
            console.log('\n📊 Coverage Summary:');
            console.log(`Statements: ${statements}% (required: ${coverageRequirements.statements}%)`);
            console.log(`Branches: ${branches}% (required: ${coverageRequirements.branches}%)`);
            console.log(`Functions: ${functions}% (required: ${coverageRequirements.functions}%)`);
            console.log(`Lines: ${lines}% (required: ${coverageRequirements.lines}%)`);
            
            const meetsRequirements = 
                parseFloat(statements) >= coverageRequirements.statements &&
                parseFloat(branches) >= coverageRequirements.branches &&
                parseFloat(functions) >= coverageRequirements.functions &&
                parseFloat(lines) >= coverageRequirements.lines;
            
            if (meetsRequirements) {
                console.log('✅ Coverage requirements met!');
            } else {
                console.log('⚠️  Coverage requirements not met.');
            }
        }
        
    } catch (error: any) {
        console.log('⚠️  Could not generate coverage report:', error.message);
    }
}

// Validation checks before running tests
async function validateTestEnvironment() {
    console.log('🔍 Validating test environment...');
    
    const checks = [
        {
            name: 'Node.js version',
            check: () => {
                const version = process.version;
                const major = parseInt(version.slice(1).split('.')[0]);
                return major >= 16;
            },
            message: 'Node.js 16+ required'
        },
        {
            name: 'Jest installation',
            check: () => {
                try {
                    execSync('npx jest --version', { stdio: 'pipe' });
                    return true;
                } catch {
                    return false;
                }
            },
            message: 'Jest not found. Run: npm install'
        },
        {
            name: 'TypeScript compilation',
            check: () => {
                try {
                    execSync('npx tsc --noEmit', { stdio: 'pipe' });
                    return true;
                } catch {
                    return false;
                }
            },
            message: 'TypeScript compilation errors. Run: npm run compile'
        }
    ];
    
    let allPassed = true;
    
    for (const check of checks) {
        const passed = check.check();
        console.log(`   ${passed ? '✅' : '❌'} ${check.name}`);
        
        if (!passed) {
            console.log(`      ${check.message}`);
            allPassed = false;
        }
    }
    
    if (!allPassed) {
        console.log('\n❌ Environment validation failed. Please fix the issues above.');
        process.exit(1);
    }
    
    console.log('✅ Environment validation passed\n');
}

// Main execution
async function main() {
    try {
        await validateTestEnvironment();
        await runIntegrationTests();
        await checkCoverage();
    } catch (error: any) {
        console.error('💥 Integration test runner failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

export { runIntegrationTests, checkCoverage, validateTestEnvironment };
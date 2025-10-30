const { RailwayClient } = require('./src/query-railway');
const { DashboardGenerator } = require('./src/generate-html');
const { testIndividualQueries } = require('./src/debug-queries');

async function testLocal() {
  console.log('🧪 Testing Railway Terminus locally...\n');

  // Check environment variables
  const requiredVars = ['RAILWAY_TOKEN', 'TERMINUS_AUTH_TOKEN'];
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach((varName) => console.error(`   - ${varName}`));
    console.log('\nPlease set these variables and try again.');
    process.exit(1);
  }

  console.log('✅ Environment variables configured\n');

  try {
    // Test Railway client
    console.log('1. Testing Railway client...');
    const client = new RailwayClient(process.env.RAILWAY_TOKEN);
    const dashboardData = await client.fetchDashboardData(process.env.RAILWAY_ENVIRONMENT_ID);

    if (dashboardData.success) {
      console.log('✅ Railway client working - data fetched successfully');
    } else {
      console.log(
        '⚠️  Railway client working but API returned error:',
        dashboardData.error.message
      );
    }

    // Test HTML generation
    console.log('\n2. Testing HTML generation...');
    const generator = new DashboardGenerator();
    generator.loadData(dashboardData);
    const html = generator.generateHTML();

    if (html && html.length > 0) {
      console.log('✅ HTML generation working -', html.length, 'characters generated');
    } else {
      console.log('❌ HTML generation failed - empty output');
    }

    // Test debug queries
    console.log('\n3. Testing debug queries...');
    await testIndividualQueries();

    console.log('\n🎉 All tests completed successfully!');
    console.log('\nTo start the server:');
    console.log('  npm start');
    console.log('\nTo test the API:');
    console.log(
      '  curl -H "Authorization: Bearer ' +
        process.env.TERMINUS_AUTH_TOKEN +
        '" http://localhost:3000/'
    );
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testLocal();
}

module.exports = { testLocal };

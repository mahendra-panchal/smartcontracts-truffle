var GRO = artifacts.require("GRO");

contract('GRO', function(accounts) {
    // migrations will use ganache account 0 by default
    var expectedFundingWallet = accounts[0];
    var controllWalletInput = accounts[1];
    var vestingContractAddress = accounts[2];
    var preSaleAllocationAddress = accounts[3];
    var randomAddress = accounts[4];
    var expectedTokenCap = 950000000; // 950 million
    const precision = Math.pow(10,18); // decimal places
    
    contract('Construction, getters, setters', function(accounts) {

	it('returns the correct fundWallet address', async function(){
	    let gro = await GRO.deployed();	    
	    let address = await gro.fundWallet();

	    assert.equal(address, expectedFundingWallet);
	});
	
	it("sets the correct tokenCap", async function() {
	    let gro = await GRO.deployed();
	    let cap = await gro.tokenCap();

	    assert.equal(expectedTokenCap * precision, cap.toNumber());
	});

	it("has the correct default GRO price", async function() {
	    let expectedPrice = 10000;
	    let gro = await GRO.deployed();	   
	    let price = await gro.currentPrice();

	    assert.equal(price.toNumber(), expectedPrice);
	});
	

	it("updates the price", async function() {
	    let expectedPrice = 3;
	    let gro = await GRO.deployed();
	    
	    await gro.updatePrice(expectedPrice);
	    let price = await gro.currentPrice();

	    assert.equal(price.toNumber(), expectedPrice);
	});
    });

    contract('firstDigit', function(accounts) {
	
	it("it should find the first digit the hex string", async function() {
	    let gro = await GRO.deployed();
	    let hex1 = "0x4bd6d687f98ecaa499da4c24c02dba51b04e04c6";
	    let hex2 = "0x12d6d687f98ecaa499da4c24c02dba51b04e04c6";
	    let hex3 = "0x00d6d687f98ecaa499da4c24c02dba51b04e04c6";
	    let hex4 = "0x01d6d687f98ecaa499da4c24c02dba51b04e04c6";
	    let hex5 = "0xrandom";
	    let hex6 = "invalid";
	    
	    let result = await gro.firstDigit.call(hex1);
	    assert.equal(String.fromCharCode(result), '4');

	    result = await gro.firstDigit.call(hex2);
	    assert.equal(String.fromCharCode(result), '1');

	    result = await gro.firstDigit.call(hex3);
	    assert.equal(String.fromCharCode(result), '0');

	    result = await gro.firstDigit.call(hex4);
	    assert.equal(String.fromCharCode(result), '0');

	    result = await gro.firstDigit.call(hex5);
	    assert.equal(String.fromCharCode(result), 'r');

	    result = await gro.firstDigit.call(hex6);
	    assert.equal(String.fromCharCode(result), 'v');
	});
    });
    
    // Redeploy contracts to network
    contract('allocatePresaletokens', function(accounts) {

	it("starts with 0 tokens issued", async function() {
	    let gro = await GRO.deployed();
	    let supply = await gro.totalSupply();
	    
	    assert.equal(supply, 0);

	    await gro.setVestingContract(vestingContractAddress);

	    let address = await gro.vestingContract();
	    assert.equal(vestingContractAddress, address);

	    let status = await gro.whitelist(vestingContractAddress);
	    assert.equal(status, true);	    
	});

	it('only allows the fundwallet to allocate pre-sale tokens', async function() {
	    // redeploy to ensure 0 totalSupply
	    let gro = await GRO.deployed();

	    try {
		let amountTokens  = 100;
		await gro.allocatePresaleTokens(preSaleAllocationAddress, amountTokens, {from: randomAddress});
	    }
	    catch (error) {
		//error thrown - transaction reverted
	    }

	    let status = await gro.whitelist(randomAddress);
	    assert.equal(status, false);

	    let supply = await gro.totalSupply();
	    assert.equal(supply, 0);	    
	});
	

	it('allocates pre-sale tokens when using the fundWallet', async function() {
	    // For a max supply of 950M - 570M pub, 380M dev allocation	    
	    let amountTokens = 285000000; // 50% the amount of public tokens
	    let expectedDevTeamAllocation = 190000000; // 50% of dev allocation expected to be allocated
	    let expectedTotalSupply = amountTokens + expectedDevTeamAllocation;
	    let randomTxnHash = 'randomTxnHash';

	    const gro = await GRO.deployed();
	    await gro.setVestingContract(vestingContractAddress);
	    
	    // initial balances
	    let devBalance = await gro.balanceOf(vestingContractAddress);
	    let participantBalance = await gro.balanceOf(preSaleAllocationAddress);
	    let supply = await gro.totalSupply();
	    
	    assert.equal(devBalance.toNumber(), 0);
	    assert.equal(participantBalance.toNumber(), 0);
	    assert.equal(supply, 0);

	    // called from accounts[0]
	    await gro.allocatePresaleTokens(preSaleAllocationAddress, preSaleAllocationAddress, amountTokens, randomTxnHash);
	    let status = await gro.whitelist(preSaleAllocationAddress);
	    assert.equal(status, false, "Participant should not be whitelisted");
	    
	    // post transaction balances
	    devBalance = await gro.balanceOf(vestingContractAddress);
	    participantBalance = await gro.balanceOf(preSaleAllocationAddress);
	    supply = await gro.totalSupply();
	    
	    assert.equal(participantBalance.toNumber(), amountTokens * precision, "Participant balance should be updated");	    
	    assert.equal(devBalance.toNumber(), expectedDevTeamAllocation * precision, "Dev team should receive allocation amount");
	    assert.equal(supply.toNumber(), expectedTotalSupply * precision, "Total supply should be updated with both allocations");
	    
	});

	it('should allocate a 10% bonus amount', async function() {
	    let amountTokens = 550;
	    let expectedAmount = 605 * precision;
	    let participant = '0x4bd6d687f98ecaa499da4c24c02dba51b04e04c6';
	    let txnHash = '0x4somerandomhash';

	    const gro = await GRO.deployed();
	    await gro.setVestingContract(vestingContractAddress);
	    
	    // initial balances
	    let participantBalance = await gro.balanceOf(participant);	    
	    assert.equal(participantBalance.toNumber(), 0);

	    // note that we can pass participant as a string for both
	    // the address and byte params in JS
	    await gro.allocatePresaleTokens(participant, participant, amountTokens, txnHash);
	    let status = await gro.whitelist(participant);
	    assert.equal(status, false, "Participant should not be whitelisted");

	    // post transaction balances
	    participantBalance = await gro.balanceOf(participant);
	    
	    assert.equal(participantBalance.toNumber(), expectedAmount, "Participant balance should be updated with bonus of 10%");	    	    
	});


	it('should not allocate a 10% bonus amount', async function() {
	    let amountTokens = 550;
	    let expectedAmount = 550 * precision;
	    let participant = '0x1bd6d687f98ecaa499da4c24c02dba51b04e04c6';
	    let txnHash = '0x3somerandomhash';

	    const gro = await GRO.deployed();
	    await gro.setVestingContract(vestingContractAddress);
	    
	    // initial balances
	    let participantBalance = await gro.balanceOf(participant);	    
	    assert.equal(participantBalance.toNumber(), 0);

	    // note that we can pass participant as a string for both
	    // the address and byte params in JS
	    await gro.allocatePresaleTokens(participant, participant, amountTokens, txnHash);
	    let status = await gro.whitelist(participant);
	    assert.equal(status, false, "Participant not should be whitelisted");

	    // post transaction balances
	    participantBalance = await gro.balanceOf(participant);
	    
	    assert.equal(participantBalance.toNumber(), expectedAmount, "Participant balance should be updated with bonus of 10%");	    	    
	});
    });

    contract('verifyParticipant', function() {
	it('should add a participant to the whitelist', async function() {
	    let gro = await GRO.deployed();	    
	    await gro.verifyParticipant(randomAddress);
	    let response = await gro.whitelist(randomAddress);

	    assert.equal(response, true);	    
	});
    });

    contract('buy', function() {
	it('should transfer the amount of ether sent to the fundWallet address', async function(){
	    let wei = web3.toWei(1, "ether"); 
	    let initialBalance = web3.fromWei(web3.eth.getBalance(expectedFundingWallet));
	    
	    let gro = await GRO.deployed();
	    await gro.setVestingContract(vestingContractAddress);

	    await gro.buy({from: randomAddress, value: wei});

	    // there should be a transfer of ether to the fundWallet
	    let updatedBalance = web3.fromWei(web3.eth.getBalance(expectedFundingWallet));
	    assert.isAtLeast(updatedBalance - initialBalance, 0.9); // transaction costs
	});
    });


    contract('withDraw', function(accounts) {
	
	it("it should fail without a withdraw request", async function() {
	    let amountTokens = 100;
	    let expectedBalance = 100 * precision;
	    let participant = randomAddress;
	    let txnHash = '0xsomerandomhash';

	    const gro = await GRO.deployed();
	    await gro.setVestingContract(vestingContractAddress);
	    
	    // initial balances
	    let participantBalance = await gro.balanceOf(participant);	    
	    assert.equal(participantBalance.toNumber(), 0);
	    await gro.allocatePresaleTokens(participant, participant, amountTokens, txnHash);
	    // post transaction balances
	    participantBalance = await gro.balanceOf(participant);	    
	    assert.equal(participantBalance.toNumber(), expectedBalance);

	    try {
		await gro.withDraw();
	    }
	    catch (error) {
		//error thrown - transaction reverted
	    }

	    // balance should remain unchanged
	    participantBalance = await gro.balanceOf(participant);	    
	    assert.equal(participantBalance.toNumber(), expectedBalance);
	});
    });

    contract('transfer', function(accounts) {

	it('should transfer GRO tokens between addresses', async function() {
	    let amountTokens = 550;
	    let expectedAmount = 550;
	    let fromAddress = accounts[0]; // fundingWallet
	    let toAddress = randomAddress;
	    let txnHash = '0x-'; // no bonuses
	    let openingBalance = 200;
	    let tokensToTransfer = 100;

	    const gro = await GRO.deployed();
	    await gro.setVestingContract(vestingContractAddress);
	    
	    // initial balances
	    let fromBalance = await gro.balanceOf(fromAddress);	    
	    assert.equal(fromBalance.toNumber(), 0);

	    let toBalance = await gro.balanceOf(toAddress);	    
	    assert.equal(toBalance.toNumber(), 0);

	    await gro.allocatePresaleTokens(fromAddress, fromAddress, openingBalance, txnHash);

	    fromBalance = await gro.balanceOf(fromAddress);	    
	    assert.equal(fromBalance.toNumber(), openingBalance * precision);

	    await gro.transfer(toAddress, tokensToTransfer * precision, {from: fromAddress}); 

	    // post transaction balances
	    fromBalance = await gro.balanceOf(fromAddress);

	    assert.equal(fromBalance.toNumber(), (openingBalance - tokensToTransfer) * precision);

	    toBalance = await gro.balanceOf(toAddress);	    
	    assert.equal(toBalance.toNumber(),  tokensToTransfer * precision);
	   
	});
    });
    	    
    contract('changeMinAmount', function() {
	it("updates the minimum purchase amount in wei", async function(){
	    let wei = web3.toWei(0.0005, "ether"); 
	    let defaultMinWei = web3.toWei(0.05, "ether");
	    
	    let gro = await GRO.deployed();
	    await gro.setVestingContract(vestingContractAddress);

	    let minAmount = await gro.minAmount();
	    assert(minAmount.toNumber(), defaultMinWei);

	    await gro.changeMinAmount(wei);

	    minAmount = await gro.minAmount();
	    assert(minAmount.toNumber(), wei);
	});
    });	
});

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AccessGrants", function () {
  let accessGrants;
  let owner, user, validator, grantee, newUser;
  let tokenId;

  beforeEach(async function () {
    [owner, user, validator, grantee, newUser] = await ethers.getSigners();
    const AccessGrants = await ethers.getContractFactory("AccessGrants");
    accessGrants = await AccessGrants.deploy(owner.address);
    await accessGrants.waitForDeployment();
    tokenId = 1;
  });

  it("should add validator, mint token, approve user, insert grant, transfer token, and check grants", async function () {
    const validatorSigner = await ethers.provider.getSigner(validator.address);
    const userSigner = await ethers.provider.getSigner(user.address);
    const granteeSigner =await ethers.provider.getSigner(grantee.address);

    const accessGrantsWithValidator = accessGrants.connect(validatorSigner);
    const accessGrantsWithUser = accessGrants.connect(userSigner);
    const accessGrantsWithGrantee = accessGrants.connect(granteeSigner);




    
    await accessGrants.addValidator(validator.address);

    await accessGrants.safeMint(user.address, tokenId, "tokenURI");
    expect(await accessGrants.ownerOf(tokenId)).to.equal(user.address);

    

    await accessGrantsWithValidator.insertAddressApproved(user.address);

    await expect(accessGrantsWithUser.insertGrant(grantee.address, "aaa", 0))
        .to.emit(accessGrants, "GrantAdded")
        .withArgs(user.address, grantee.address, "aaa", 0);

    const grants = await accessGrantsWithGrantee.findGrants(user.address, grantee.address, "aaa");
    expect(grants.length).to.equal(1);

    await expect(accessGrantsWithUser.transferFrom(user.address, newUser.address, tokenId))
        .to.emit(accessGrants, "TokenTransfered")
        .withArgs(user.address, newUser.address);

   try {
    const newGrants = await accessGrantsWithGrantee.findGrants(newUser.address, grantee.address, "aaa");
  } catch (e) {
    console.log(e);
  }

});
});

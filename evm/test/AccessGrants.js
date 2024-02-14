const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const WILDCARD_ADDRESS = ethers.ZeroAddress;
const WILDCARD_DATA = "0";
const NO_TIMELOCK = 0n;

describe("AccessGrants", function () {
  async function deployAndPopulateContractFixture() {
    const [_, signer1, signer2, signer3, signer4] = await ethers.getSigners();

    const AccessGrants = await ethers.getContractFactory("AccessGrants");
    const accessGrants = await AccessGrants.deploy();

    await accessGrants.connect(signer1).insertGrant(signer2, "1A", NO_TIMELOCK);
    await accessGrants.connect(signer1).insertGrant(signer2, "1B", NO_TIMELOCK);
    await accessGrants.connect(signer1).insertGrant(signer3, "1A", NO_TIMELOCK);

    await accessGrants.connect(signer2).insertGrant(signer1, "2A", NO_TIMELOCK);
    await accessGrants.connect(signer2).insertGrant(signer3, "2A", NO_TIMELOCK);

    return { accessGrants, signer1, signer2, signer3, signer4 };
  }

  describe("Grant management", function () {
    describe("Creating grants", function () {
      describe("By owner through insertGrant", function () {
        it("A grant can only be owned by its creator", async function () {
          const { accessGrants, signer1: owner, signer2: grantee } = await loadFixture(deployAndPopulateContractFixture);

          let grants = await accessGrants.findGrants(owner, grantee, "1A");

          expect(grants.length).to.equal(1);
          expect(grants[0].owner).to.equal(owner.address);
        });

        it("A duplicate grant cannot be created", async function () {
          const { accessGrants, signer1: owner, signer2: grantee } = await loadFixture(deployAndPopulateContractFixture);

          await expect(
            accessGrants.connect(owner).insertGrant(grantee, "1A", NO_TIMELOCK)
          ).to.be.revertedWith("Grant already exists");
        });
      });

      describe("By anybody through insertGrantBySignature", function () {
        it("Inserts grant", async function () {
          const { accessGrants, signer1: caller, signer2: owner, signer3: grantee } = await loadFixture(deployAndPopulateContractFixture);
          const contract = accessGrants.connect(caller);

          const dataId = "849690b7-fee1-46d8-8c91-0268b0cc1850";
          const lockedUntil = 50n;

          const signature = await owner.signMessage(await contract.insertGrantBySignatureMessage(owner.address, grantee.address, dataId, lockedUntil));

          await contract.insertGrantBySignature(owner.address, grantee.address, dataId, lockedUntil, signature);
          let grants = await accessGrants.findGrants(owner.address, grantee.address, dataId);

          expect(grants.length).to.equal(1);
          expect(grants).to.eql([
            [owner.address, grantee.address, dataId, lockedUntil],
          ]);
        });

        it("Fails when the signature is wrong", async function () {
          const { accessGrants, signer1: caller, signer2: owner, signer3: grantee } = await loadFixture(deployAndPopulateContractFixture);
          const dataId = "849690b7-fee1-46d8-8c91-0268b0cc1850";
          const lockedUntil = 50n;

          const signature = "0xcda9acd962714be67a2b0fe14c4ffa5e51c2912f463f72a293d9157ccea1a31b15541a5e5dcf35e4bf6e3bb58b3e5ae569859cfd3c6272a8ff647d544f0cea061c";

          await expect(
            accessGrants.connect(caller).insertGrantBySignature(owner.address, grantee.address, dataId, lockedUntil, signature)
          ).to.be.revertedWith("Signature doesn't match");
        });
      });
    });

    describe("Deleting grants", function () {
      it("A grant can be deleted by its owner", async function () {
        const { accessGrants, signer1: owner, signer2: grantee } = await loadFixture(deployAndPopulateContractFixture);

        const lockedUntil = await time.latest() - 1000;

        await accessGrants.connect(owner).insertGrant(grantee, "some ID", lockedUntil);

        await expect(
          accessGrants.connect(owner).deleteGrant(grantee, "some ID", lockedUntil)
        ).to.not.be.revertedWith("Grant is timelocked");
      });

      it("A grant cannot be deleted by anyone else", async function () {
        const { accessGrants, signer1: owner, signer2: grantee } = await loadFixture(deployAndPopulateContractFixture);

        const lockedUntil = await time.latest() - 1000;

        await accessGrants.connect(owner).insertGrant(grantee, "some ID", lockedUntil);

        await expect(
          accessGrants.connect(grantee).deleteGrant(grantee, "some ID", lockedUntil)
        ).to.be.revertedWith("No grants for sender");

        let grants = await accessGrants.findGrants(owner, grantee, "some ID");

        expect(grants.length).to.equal(1);
      });

      describe("Timelocks", function () {
        describe("When given", function () {
          it("A grant cannot be deleted while locked", async function () {
            const { accessGrants, signer1: owner, signer2: grantee } = await loadFixture(deployAndPopulateContractFixture);

            const lockedUntil = await time.latest() + 1000;

            await accessGrants.connect(owner).insertGrant(grantee, "some ID", lockedUntil);
            await expect(
              accessGrants.connect(owner).deleteGrant(grantee, "some ID", lockedUntil)
            ).to.be.revertedWith("Grant is timelocked");

            let grants = await accessGrants.findGrants(owner, grantee, "some ID");

            expect(grants.length).to.equal(1);
          });

          it("A grant can be deleted if timelock is expired", async function () {
            const { accessGrants, signer1: owner, signer2: grantee } = await loadFixture(deployAndPopulateContractFixture);

            const lockedUntil = await time.latest() - 1000;

            await accessGrants.connect(owner).insertGrant(grantee, "some ID", lockedUntil);
            await expect(
              accessGrants.connect(owner).deleteGrant(grantee, "some ID", lockedUntil)
            ).to.not.be.revertedWith("Grant is timelocked");

            let grants = await accessGrants.findGrants(owner, grantee, "some ID");

            expect(grants.length).to.equal(0);
          });

          it("A grant can be deleted if timelock is expired", async function () {
            const { accessGrants, signer1: owner, signer2: grantee } = await loadFixture(deployAndPopulateContractFixture);

            const lockedUntil = await time.latest() - 1000;

            await accessGrants.connect(owner).insertGrant(grantee, "some ID", lockedUntil);
            await expect(
              accessGrants.connect(owner).deleteGrant(grantee, "some ID", lockedUntil)
            ).to.not.be.revertedWith("Grant is timelocked");

            let grants = await accessGrants.findGrants(owner, grantee, "some ID");

            expect(grants.length).to.equal(0);
          });
        });

        describe("When not given", function () {
          it("All mathing grants are deleted if all timelocks are expired", async function () {
            const { accessGrants, signer1: owner, signer2: grantee } = await loadFixture(deployAndPopulateContractFixture);

            const lockedUntil = await time.latest() - 1000;

            await accessGrants.connect(owner).insertGrant(grantee, "some ID", lockedUntil + 0);
            await accessGrants.connect(owner).insertGrant(grantee, "some ID", lockedUntil + 1);
            await accessGrants.connect(owner).insertGrant(grantee, "some ID", lockedUntil + 2);

            await expect(
              accessGrants.connect(owner).deleteGrant(grantee, "some ID", NO_TIMELOCK)
            ).to.not.be.revertedWith("Grant is timelocked");

            let grants = await accessGrants.findGrants(owner, grantee, "some ID");

            expect(grants.length).to.equal(0);
          });

          it("No grants are deleted if one or more timelocks are expired", async function () {
            const { accessGrants, signer1: owner, signer2: grantee } = await loadFixture(deployAndPopulateContractFixture);

            const lockedUntil = await time.latest() - 1000;

            await accessGrants.connect(owner).insertGrant(grantee, "some ID", lockedUntil + 0);
            await accessGrants.connect(owner).insertGrant(grantee, "some ID", lockedUntil + 1);
            await accessGrants.connect(owner).insertGrant(grantee, "some ID", lockedUntil + 2000);

            await expect(
              accessGrants.connect(owner).deleteGrant(grantee, "some ID", NO_TIMELOCK)
            ).to.be.revertedWith("Grant is timelocked");

            let grants = await accessGrants.findGrants(owner, grantee, "some ID");

            expect(grants.length).to.equal(3);
          });
        });
      });
    });

    describe("Reading grants", function () {
      describe("grantsFor", async function () {
        describe("When the grant doesn't exist", async function () {
          it("Returns no grants", async function () {
            const { accessGrants, signer1: owner, signer2: grantee } = await loadFixture(deployAndPopulateContractFixture);

            await accessGrants.connect(owner).insertGrant(grantee, "some ID", NO_TIMELOCK);

            let grants = await accessGrants.grantsFor(grantee, "bad ID");

            expect(grants.length).to.equal(0);
            expect(grants).to.eql([]);
          });
        });

        describe("When the grant exists", async function () {
          it("Returns the grant, regardless of caller", async function () {
            const { accessGrants, signer1: owner, signer2: grantee } = await loadFixture(deployAndPopulateContractFixture);

            await accessGrants.connect(owner).insertGrant(grantee, "some ID", NO_TIMELOCK);

            let grants1 = await accessGrants.connect(owner).grantsFor(grantee, "some ID");
            let grants2 = await accessGrants.connect(grantee).grantsFor(grantee, "some ID");

            expect(grants1.length).to.equal(1);
            expect(grants1).to.eql([
              [owner.address, grantee.address, "some ID", NO_TIMELOCK],
            ]);
            expect(grants1).to.eql(grants2);
          });
        });
      });

      describe("findGrants", async function () {
        describe("When the grant doesn't exist", async function () {
          it("Returns no grants", async function () {
            const { accessGrants, signer1: owner, signer2: grantee } = await loadFixture(deployAndPopulateContractFixture);

            await accessGrants.connect(owner).insertGrant(grantee, "some ID", NO_TIMELOCK);

            let grants = await accessGrants.findGrants(owner, grantee, "bad ID");

            expect(grants.length).to.equal(0);
            expect(grants).to.eql([]);
          });
        });

        describe("When grants exists", async function () {
          it("Returns the grant, regardless of caller", async function () {
            const { accessGrants, signer1: owner, signer2: grantee } = await loadFixture(deployAndPopulateContractFixture);

            await accessGrants.connect(owner).insertGrant(grantee, "some ID", NO_TIMELOCK);

            let grants1 = await accessGrants.connect(owner).findGrants(owner, grantee, "some ID");
            let grants2 = await accessGrants.connect(grantee).findGrants(owner, grantee, "some ID");

            expect(grants1.length).to.equal(1);
            expect(grants1).to.eql([
              [owner.address, grantee.address, "some ID", 0n],
            ]);
            expect(grants1).to.eql(grants2);
          });

          describe("With wildcard arguments", async function () {
            it("Reverts if neither owner nor grantee provided", async function () {
              const { accessGrants } = await loadFixture(deployAndPopulateContractFixture);

              await expect(
                accessGrants.findGrants(WILDCARD_ADDRESS, WILDCARD_ADDRESS, "some ID")
              ).to.be.revertedWith("Required argument: `owner` and/or `grantee`");
            });

            describe("Given owner", async function () {
              it("Returns grants for any grantee, any data", async function () {
                const { accessGrants, signer1, signer2, signer3 } = await loadFixture(deployAndPopulateContractFixture);

                let grants = await accessGrants.findGrants(signer1, WILDCARD_ADDRESS, WILDCARD_DATA);

                expect(grants.length).to.equal(3);
                expect(grants).to.eql([
                  [signer1.address, signer2.address, "1A", 0n],
                  [signer1.address, signer2.address, "1B", 0n],
                  [signer1.address, signer3.address, "1A", 0n],
                ]);

                grants = await accessGrants.findGrants(signer2, WILDCARD_ADDRESS, WILDCARD_DATA);

                expect(grants.length).to.equal(2);
                expect(grants).to.eql([
                  [signer2.address, signer1.address, "2A", 0n],
                  [signer2.address, signer3.address, "2A", 0n],
                ]);
              });

              it("Returns grants for given grantee, any data", async function () {
                const { accessGrants, signer1, signer2, signer3 } = await loadFixture(deployAndPopulateContractFixture);

                let grants = await accessGrants.findGrants(signer1, signer2, WILDCARD_DATA);

                expect(grants.length).to.equal(2);
                expect(grants).to.eql([
                  [signer1.address, signer2.address, "1A", 0n],
                  [signer1.address, signer2.address, "1B", 0n],
                ]);

                grants = await accessGrants.findGrants(signer1, signer3, WILDCARD_DATA);

                expect(grants.length).to.equal(1);
                expect(grants).to.eql([
                  [signer1.address, signer3.address, "1A", 0n],
                ]);
              });

              it("Returns grants for any grantee, given data", async function () {
                const { accessGrants, signer1, signer2, signer3 } = await loadFixture(deployAndPopulateContractFixture);

                let grants = await accessGrants.findGrants(signer1, WILDCARD_ADDRESS, "1A");

                expect(grants.length).to.equal(2);
                expect(grants).to.eql([
                  [signer1.address, signer2.address, "1A", 0n],
                  [signer1.address, signer3.address, "1A", 0n],
                ]);

                grants = await accessGrants.findGrants(signer2, WILDCARD_ADDRESS, "2A");

                expect(grants.length).to.equal(2);
                expect(grants).to.eql([
                  [signer2.address, signer1.address, "2A", 0n],
                  [signer2.address, signer3.address, "2A", 0n],
                ]);
              });
            });


            describe("Given grantee", async function () {
              it("Returns grants for any ownwer, any data", async function () {
                const { accessGrants, signer1, signer2, signer3 } = await loadFixture(deployAndPopulateContractFixture);

                let grants = await accessGrants.findGrants(WILDCARD_ADDRESS, signer1, WILDCARD_DATA);

                expect(grants.length).to.equal(1);
                expect(grants).to.eql([
                  [signer2.address, signer1.address, "2A", 0n],
                ]);

                grants = await accessGrants.findGrants(WILDCARD_ADDRESS, signer3, WILDCARD_DATA);

                expect(grants.length).to.equal(2);
                expect(grants).to.eql([
                  [signer1.address, signer3.address, "1A", 0n],
                  [signer2.address, signer3.address, "2A", 0n],
                ]);
              });

              it("Returns grants for any ownwer, given data", async function () {
                const { accessGrants, signer1, signer2, signer3 } = await loadFixture(deployAndPopulateContractFixture);

                let grants = await accessGrants.findGrants(WILDCARD_ADDRESS, signer2, "1A");

                expect(grants.length).to.equal(1);
                expect(grants).to.eql([
                  [signer1.address, signer2.address, "1A", 0n],
                ]);

                grants = await accessGrants.findGrants(WILDCARD_ADDRESS, signer3, "2A");

                expect(grants.length).to.equal(1);
                expect(grants).to.eql([
                  [signer2.address, signer3.address, "2A", 0n],
                ]);
              });
            });
          });
        });
      });
    });
  });

  describe("Events", function () {
    describe("when a grant inserted", function () {
      it("Creates GrantAdded event", async function () {
        const { accessGrants, signer1: caller, signer2: owner, signer3: grantee } = await loadFixture(deployAndPopulateContractFixture);
        const dataId = "849690b7-fee1-46d8-8c91-0268b0cc1850";
        const lockedUntil = 50n;
        await accessGrants.connect(owner).insertGrant(grantee, dataId, lockedUntil);

        const eventTopic = ethers.id("GrantAdded(address,address,string,uint256)");
        const logs = await ethers.provider.getLogs({
          address: accessGrants.address,
          topics: [
            eventTopic,
            ethers.zeroPadValue(owner.address, 32),
            ethers.zeroPadValue(grantee.address, 32),
            ethers.keccak256(ethers.toUtf8Bytes(dataId)),
          ],
        });
        expect(logs.length).to.equal(1);
        expect(logs[0].data).to.equal(lockedUntil);
      });
    });
    describe("when a grant deleted", function () {
      it("Creates GrantDeleted event", async function () {
        const { accessGrants, signer1: caller, signer2: owner, signer3: grantee } = await loadFixture(deployAndPopulateContractFixture);
        const dataId = "849690b7-fee1-46d8-8c91-0268b0cc1850";
        const lockedUntil = 50n;
        await accessGrants.connect(owner).insertGrant(grantee, dataId, lockedUntil);
        await accessGrants.connect(owner).deleteGrant(grantee, dataId, lockedUntil);

        const eventTopic = ethers.id("GrantDeleted(address,address,string,uint256)");
        const logs = await ethers.provider.getLogs({
          address: accessGrants.address,
          topics: [
            eventTopic,
            ethers.zeroPadValue(owner.address, 32),
            ethers.zeroPadValue(grantee.address, 32),
            ethers.keccak256(ethers.toUtf8Bytes(dataId)),
          ],
        });
        expect(logs.length).to.equal(1);
        expect(logs[0].data).to.equal(lockedUntil);
      });
    });

  });
});

# Sputnik DAO v2 implementation reference

Fetched: 2026-11-11T11:53:29.206Z

Upstream: https://github.com/near-daos/sputnik-dao-contract

Pinned revision: `5434a59dec23ee0c49df8c8c4350c208a7e75b0b`

## How to use this file

Use the Rust definitions below for exact proposal JSON variants, view methods, bonds, policy permissions, voting actions and execution callbacks. This is upstream source, not proof that a target DAO runs this exact contract. Confirm the deployed version before integration. Do not equate a submitted transaction or successful vote with a completed payment; inspect proposal state and execution receipts.

This is a local reference bundle, not application code. Upstream setup commands are reference material only; do not execute them automatically. MDX components and relative links are preserved as source text and may require consulting the linked upstream file. Embedded sources are delimited with long fences so their internal Markdown remains intact.

## Contents

- [README.md](https://github.com/near-daos/sputnik-dao-contract/blob/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/README.md)
- [sputnikdao2/src/lib.rs](https://github.com/near-daos/sputnik-dao-contract/blob/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/sputnikdao2/src/lib.rs)
- [sputnikdao2/src/types.rs](https://github.com/near-daos/sputnik-dao-contract/blob/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/sputnikdao2/src/types.rs)
- [sputnikdao2/src/views.rs](https://github.com/near-daos/sputnik-dao-contract/blob/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/sputnikdao2/src/views.rs)
- [sputnikdao2/src/policy.rs](https://github.com/near-daos/sputnik-dao-contract/blob/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/sputnikdao2/src/policy.rs)
- [sputnikdao2/src/proposals.rs](https://github.com/near-daos/sputnik-dao-contract/blob/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/sputnikdao2/src/proposals.rs)
- [sputnikdao2/src/ext_fungible_token.rs](https://github.com/near-daos/sputnik-dao-contract/blob/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/sputnikdao2/src/ext_fungible_token.rs)

## README.md

Source: https://raw.githubusercontent.com/near-daos/sputnik-dao-contract/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/README.md

`````markdown
# Sputnik DAO

> Building on the functionality of [Sputnik V1](https://github.com/near-daos/sputnik-dao-contract-legacy), Sputnik DAO V2 offers even more features and enhanced configuration ability. Sputnik V1 is archived because it can no longer be extended. Its newer version, Sputnik V2, aims to be more flexible in this regard and it provides new features that can be opt-in by the users. [Code Review video with Trevor of CronCat](https://www.youtube.com/watch?v=M8AafQSLi7g&list=PLPxUkIZ41o-2iQWQf_wlyugF7JaY5b5bJ&index=3).

## Overview

| Name                                          | Description                                                           |
| --------------------------------------------- | --------------------------------------------------------------------- |
| [Setup](#setup)                               | Step-by-step guide to deploy a DAO factory and DAO contracts.         |
| [Roles & Permissions](#roles-and-permissions) | Setup roles and define permissions for each role.                     |
| [Proposals](#proposals)                       | Each action on the DAO is done by creating and approving a proposal.  |
| [Voting](#voting)                             | Configure policies, setup governance tokens, and vote on proposals.   |
| [Bounties](#bounties)                         | Add and configure bounties.                                           |
| [Blob Storage](#blob-storage)                 | Store large data blobs and content and index them by the data's hash. |
| [Upgradability](#upgradability)               | Upgrade the DAO to different contract code versions.                  |

---

## Setup

### Prerequisites

1. [NEAR Account](https://wallet.testnet.near.org)
2. [NEAR-CLI](https://near.cli.rs)
3. [cargo-near CLI](https://github.com/near/cargo-near)
4. [Rust](https://www.rust-lang.org)
5. [Docker](https://www.docker.com/) (for production builds)

<details>
<summary>3-Step Rust Installation.</summary>
<p>

1. Install Rustup:

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

[_(Taken from official installation guide)_](https://www.rust-lang.org/tools/install)

2. Configure your current shell:

```
source $HOME/.cargo/env
```

3. Add Wasm target to your toolchain:

```
rustup target add wasm32-unknown-unknown
```

</p>
</details>

---

<details>
<summary>1. Login with your account.</summary>
<p>

Using [`near-cli`](https://near.cli.rs), login to your account which will save your credentials locally:

```bash
near login
```

</p>
</details>

<details>
<summary>2. Clone repository.</summary>
<p>

```bash
git clone https://github.com/near-daos/sputnik-dao-contract
```

</p>
</details>

<details>
<summary>3. Build factory contract.</summary>
<p>

```bash
cd sputnik-dao-contract/sputnikdao-factory2 && cargo near build reproducible-wasm
```

</p>
</details>

<details>
<summary>4. Deploy factory.</summary>
<p>

- Create an env variable replacing `YOUR_ACCOUNT.testnet` with the name of the account you logged in with earlier:

```bash
export CONTRACT_ID=YOUR_ACCOUNT.testnet
```

- Deploy factory contract by running the following command from your current directory _(`sputnik-dao-contract/sputnikdao-factory2`)_:

```bash
near deploy $CONTRACT_ID --wasmFile=target/near/sputnikdao_factory2/sputnikdao_factory2.wasm --accountId $CONTRACT_ID
```

</p>
</details>

<details>
<summary>5. Initialize factory.</summary>
<p>

```bash
near call $CONTRACT_ID new --accountId $CONTRACT_ID --gas 100000000000000
```

</p>
</details>

<details>
<summary>6. Define the parameters of the new DAO, its council, and create it.</summary>
<p>

- Define the council of your DAO:

```bash
export COUNCIL='["council-member.testnet", "YOUR_ACCOUNT.testnet"]'
```

- Configure the name, purpose, and initial council members of the DAO and convert the arguments in base64:

```bash
export ARGS=`echo '{"config": {"name": "genesis", "purpose": "Genesis DAO", "metadata":""}, "policy": '$COUNCIL'}' | base64`
```

- Create the new DAO!:

```bash
near call $CONTRACT_ID create "{\"name\": \"genesis\", \"args\": \"$ARGS\"}" --accountId $CONTRACT_ID --amount 10 --gas 150000000000000
```

**Example Response:**

```bash
Scheduling a call: sputnik-v2.testnet.create({"name": "genesis", "args": "eyJjb25maWciOiB7Im5hbWUiOiAiZ2VuZXNpcyIsICJwdXJwb3NlIjogIkdlbmVzaXMgREFPIiwgIm1ldGFkYXRhIjoiIn0sICJwb2xpY3kiOiBbImNvdW5jaWwtbWVtYmVyLnRlc3RuZXQiLCAiWU9VUl9BQ0NPVU5ULnRlc3RuZXQiXX0K"}) with attached 5 NEAR
Transaction Id 5beqy8ZMkzpzw7bTLPMv6qswukqqowfzYXZnMAitRVS7
To see the transaction in the transaction explorer, please open this url in your browser
https://explorer.testnet.near.org/transactions/5beqy8ZMkzpzw7bTLPMv6qswukqqowfzYXZnMAitRVS7
true
```

**Note:** If you see `false` at the bottom (after the transaction link) something went wrong. Check your arguments passed and target contracts and re-deploy.

</p>
</details>

<details>
<summary>7. Verify successful deployment and policy configuration.</summary>
<p>

The DAO deployment will create a new [sub-account](https://docs.near.org/docs/concepts/account#subaccounts) ( `genesis.YOUR_ACCOUNT.testnet` ) and deploy a Sputnik v2 DAO contract to it.

- Setup another env variable for your DAO contract:

```bash
export SPUTNIK_ID=genesis.$CONTRACT_ID
```

- Now call `get_policy` on this contract using [`near view`](https://docs.near.org/docs/tools/near-cli#near-view)

```bash
near view $SPUTNIK_ID get_policy
```

- Verify that the name, purpose, metadata, and council are all configured correctly. Also note the following default values:

```json
{
  "roles": [
    {
      "name": "all",
      "kind": "Everyone",
      "permissions": ["*:AddProposal"],
      "vote_policy": {}
    },
    {
      "name": "council",
      "kind": { "Group": ["council-member.testnet", "YOUR_ACCOUNT.testnet"] },
      "permissions": [
        "*:Finalize",
        "*:AddProposal",
        "*:VoteApprove",
        "*:VoteReject",
        "*:VoteRemove"
      ],
      "vote_policy": {}
    }
  ],
  "default_vote_policy": {
    "weight_kind": "RoleWeight",
    "quorum": "0",
    "threshold": [1, 2]
  },
  "proposal_bond": "1000000000000000000000000",
  "proposal_period": "604800000000000",
  "bounty_bond": "1000000000000000000000000",
  "bounty_forgiveness_period": "86400000000000"
}
```

</p>
</details>

---

## Roles and Permissions

> The DAO can have several roles, each of which allows for permission configuring. These permissions are a combination of [`proposal_kind`](#proposal-types) and `VotingAction`. Due to this combination these permissions can be scoped to be very specific or you can use wildcards to grant greater access.

**Examples:**

- A role with: `["transfer:VoteReject","transfer:VoteRemove"]` means they can only vote to _reject_ or _remove_ a `transfer` proposal but they can't vote to approve.

- A role with: `["transfer:*"]` can perform any vote action on `transfer` proposals.

- A role with: `["*:*"]` has _unlimited_ permission. Normally, the `council` role has `*:*` as its permission so they can perform _any_ vote action on _any_ kind of proposal.

**Here is a list of actions:**

- `AddProposal` - _Adds given proposal to the DAO (this is the primary mechanism for getting things done)._
- `RemoveProposal` - _Removes given proposal (this is used for immediate deletion in special cases)._
- `VoteApprove` - _Votes to approve given proposal or bounty._
- `VoteReject` - _Votes to reject given proposal or bounty._
- `VoteRemove` - _Votes to remove given proposal or bounty (this may be because the proposal is spam or otherwise invalid)._
- `Finalize` - _Finalizes proposal which is cancelled when proposal has expired (this action also returns funds)._
- `MoveToHub` - _Moves a proposal to the hub (this is used to move a proposal into another DAO)._

---

## Proposals

> Proposals are the main way to interact with the DAO. Each action on the DAO is performed by creating and approving a proposal.

| Contents                                            |
| --------------------------------------------------- |
| [Proposal types](#proposal-types)                   |
| [Add proposal](#add-proposal)                       |
| [View proposal](#view-proposal)                     |
| [View multiple proposals](#view-multiple-proposals) |
| [Approve proposal](#approve-proposal)               |

---

### Proposal types

> Each kind of proposal represents an operation the DAO can perform. Here are the kinds of proposals:

```rs
ProposalKind::ChangeConfig { .. },
ProposalKind::ChangePolicy { .. },
ProposalKind::AddMemberToRole { .. },
ProposalKind::RemoveMemberFromRole { .. },
ProposalKind::FunctionCall { .. },
ProposalKind::UpgradeSelf { .. },
ProposalKind::UpgradeRemote { .. },
ProposalKind::Transfer { .. },
ProposalKind::SetStakingContract { .. },
ProposalKind::AddBounty { .. },
ProposalKind::BountyDone { .. },
ProposalKind::Vote,
ProposalKind::FactoryInfoUpdate { .. },
ProposalKind::ChangePolicyAddOrUpdateRole { .. },
ProposalKind::ChangePolicyRemoveRole { .. },
ProposalKind::ChangePolicyUpdateDefaultVotePolicy { .. },
ProposalKind::ChangePolicyUpdateParameters { .. },
```

- **ChangeConfig** - used to change the configuration of the DAO
- **ChangePolicy** - used to change the full policy of the DAO
- **AddMemberToRole** - used to add a member to a role in the DAO
- **RemoveMemberFromRole** - used to remove a member from a role in the DAO
- **FunctionCall** - used to a call a function on any valid account on the network including the DAO itself, any other DAO, or any other contract. This is a useful mechanism for extending the capabilities of the DAO without modifying or complicating the DAO contract code.  One can imagine a family of contracts built specifically to serve the DAO as agents, proxies, oracles and banks, for example.
- **UpgradeSelf** - used to upgrade the DAO contract itself.
- **UpgradeRemote** - used to upgrade other contracts. For DAOs that are governing other protocols, this type of proposal will allow to upgrade another contract with its newer version.
- **Transfer** - used to move assets from this DAO to another account on the network. Supports both `NEAR` and any `NEP-141` token that this DAO has.
- **SetStakingContract** - used to set the staking contract of the DAO to help users delegate their tokens.
- **AddBounty** - used to add a bounty to encourage members of the DAO community to contribute their time and attention to the needs of the DAO
- **BountyDone** - used to mark the completion of an available bounty
- **Vote** - used to create polls. Vote proposal doesn't have any action.
- **FactoryInfoUpdate** - used for changing permissions of the factory that created the DAO. By default, the factory has permission to upgrade the DAO, but this can be modified by using `FactoryInfoUpdate`.
- **ChangePolicyAddOrUpdateRole** - used to add a new role to the policy of the DAO. If the role already exists, update it.
- **ChangePolicyRemoveRole** - used to remove a role from the policy of the DAO.
- **ChangePolicyUpdateDefaultVotePolicy** - used to update the default vote policy from the policy of the DAO.
- **ChangePolicyUpdateParameters** - used to update the parameters from the policy of the DAO. Parameters include: proposal bond, proposal period, bounty bond, bounty forgiveness period.

---

### Add proposal

> Adds a proposal to the DAO contract and returns the index number of the proposal or "proposal ID". By default, anyone can add a proposal but it requires a minimum 1 Ⓝ bond (attached deposit).

- method: `add_proposal`
- params:
  - `proposal`
    - `description`
    - `kind`
- proposer account ID
- attached deposit (minimum 1 Ⓝ)

<details>
<summary>Example argument structure:</summary>
<p>

```json
{
  "proposal": {
    "description": "Add New Council",
    "kind": {
      "AddMemberToRole": {
        "member_id": "council_member_3.testnet",
        "role": "council"
      }
    }
  }
}
```

</p>
</details>

<details>
<summary>Example near-cli command:</summary>
<p>

```bash
near call genesis.sputnik-v2.testnet add_proposal \
'{"proposal": {"description": "Add New Council", "kind": {"AddMemberToRole": {"member_id": "council_member_3.testnet", "role": "council"}}}}' \
--accountId proposer.testnet \
--amount 1
```

</p>
</details>

<details>
<summary>Example response:</summary>
<p>

```bash
Transaction Id HbJdK9AnZrvjuuoys2z1PojdkyFiuWBvrDbXsAf5ndvu
To see the transaction in the transaction explorer, please open this url in your browser
https://explorer.testnet.near.org/transactions/HbJdK9AnZrvjuuoys2z1PojdkyFiuWBvrDbXsAf5ndvu
0
```

**Note:** The number under the transaction link is the proposal ID.

</p>
</details>

---

### View proposal

> Returns proposal details by passing the ID or index of a given proposal.

- method: `get_proposal`
  - params: `id`

<details>
<summary>Example near-cli command:</summary>
<p>

```bash
near view genesis.sputnik-v2.testnet get_proposal '{"id": 0}'
```

</p>
</details>

<details>
<summary>Example response:</summary>
<p>

```json
{
  "id": 0,
  "proposer": "near-example.testnet",
  "description": "Add New Council",
  "kind": {
    "AddMemberToRole": {
      "member_id": "council_member_3.testnet",
      "role": "council"
    }
  },
  "status": "InProgress",
  "vote_counts": {},
  "votes": {},
  "submission_time": "1624947631810665051"
}
```

</p>
</details>

---

### View multiple proposals

> Returns multiple proposal details by passing the index ("ID") starting point and a limit of how many records you would like returned.

- method: `get_proposals`
- params:
  - `from_index`
  - `limit`

<details>
<summary>Example near-cli command:</summary>
<p>

```bash
near view genesis.sputnik-v2.testnet get_proposals '{"from_index": 1, "limit": 2}'
```

</p>
</details>

<details>
<summary>Example response:</summary>
<p>

```js
[
  {
    id: 1,
    proposer: 'near-example.testnet',
    description: 'Add New Council',
    kind: {
      AddMemberToRole: { member_id: 'council_member_4.testnet', role: 'council' }
    },
    status: 'InProgress',
    vote_counts: {},
    votes: {},
  submission_time: '1624947785010147691'
  },
  {
    id: 2,
    proposer: 'near-example.testnet',
    description: 'Add New Council',
    kind: {
      AddMemberToRole: { member_id: 'council_member_5.testnet', role: 'council' }
    },
    status: 'InProgress',
    vote_counts: {},
    votes: {},
    submission_time: '1624947838518330827'
  }
]
```

</p>
</details>

---

### Approve proposal

> Approves proposal by ID. Only council members can approve a proposal

- method: `act_proposal`
- params:
  - `id`
  - `action`
- account ID that is a council member.

<details>
<summary>Example near-cli command:</summary>
<p>

```bash
near call genesis.sputnik-v2.testnet act_proposal '{"id": 0, "action": "VoteApprove"}' \
--accountId council_member_1.testnet
```

</p>
</details>

<details>
<summary>Example response:</summary>
<p>

```bash
Receipts: 3mkSgRaHsd46FHkf9AtTcPbNXkYkxMCzPfJFHsHk8NPm, GjJ6hmoAhxt2a7si4hVPYZiL9CWeM5fmSEzMTpC7URxV
        Log [genesis.sputnik-v2.testnet]: ["council"]
Transaction Id BZPHxNoBpyMG4seCojzeNrKpr685vWPynDMTdg1JACa7
To see the transaction in the transaction explorer, please open this url in your browser
https://explorer.testnet.near.org/transactions/BZPHxNoBpyMG4seCojzeNrKpr685vWPynDMTdg1JACa7
''
```

</p>
</details>

---

## Voting

>

### Vote on a proposal

> Only council members are allowed to vote on a proposal.

---

### Voting policy

> You can set a different vote policy for each one of the proposal kinds.

Vote policy can be: `TokenWeight`, meaning members vote with tokens, or `RoleWeight(role)` where all users with such role (e.g."council") can vote.

Also a vote policy has a "threshold". The threshold could be a ratio. e.g. `threshold:[1,2]` => 1/2 or 50% of the votes approve the proposal, or the threshold could be a fixed number (weight), so you can say that you need 3 votes to approve a proposal disregarding the amount of people in the role, and you can say that you need 1m tokens to approve a proposal disregarding total token supply.

When vote policy is `TokenWeight`, vote % is measured against total toke supply, and each member vote weight is based on tokens owned. So if threshold is 1/2 you need half the token supply to vote "yes" to pass a proposal.

When vote policy is `RoleWeight(role)`, vote % is measured against the count of people with that role, and each member has one vote. So if threshold is 1/2 you need half the members with the role to vote "yes" to pass a proposal.

---

### Token voting

> DAO votes to select some token to become voting token (only can be done once, can't change later).

User flow to vote with selected token:

- Users deposit the desired amount of the token to the separate staking contract defined by the DAO.
- They can then choose who to delegate these tokens. It can be to themselves or to other users to increase their vote weight.
- When users vote for proposals, their vote is weighted by all the delegations to them.
- Undelegating will block delegating / withdrawing until one voting period passes.
- Undelegated tokens can be withdrawn by the user.

---

## Bounties

> Add and configure bounties using `AddBounty` proposal.

The lifecycle of a bounty is the next:

- Anyone with permission can add proposal `AddBounty` which contains the bounty information including `token` to pay the reward in and `amount` to pay it out.
- This proposal gets voted in by the current voting policy.
- After proposal is passed, the bounty gets added. Now it has an `id` in the bounty list which can be queried via `get_bounties`.
- Anyone can claim a bounty by calling `bounty_claim(id, deadline)` up to `repeat` times which was specified in the bounty. This allows to have repetitive bounties or multiple working collaboratively.
- `deadline` specifies how long it will take the sender to complete the bounty.
- If claimer decides to give up, they can call `bounty_giveup(id)`, and within `forgiveness_period` their claim bond will be returned. After this period, their bond is forfeited and is kept in the DAO.
- When a bounty is complete, call `bounty_done(id)`, which will add a proposal `BountyDone` that, when voted, will pay to whoever completed the bounty.

---

## Blob storage

> DAO supports storing larger blobs of data and content indexing them by hash of the data. This is done to allow upgrading the DAO itself and other contracts.

Blob lifecycle:

- Store blob in the DAO.
- Create upgradability proposal.
- Proposal passes or fails.
- Remove blob and receive funds locked for storage back.

Blob can be removed only by the original storer.

---

## Upgradability

> Allow the DAO to be upgraded to different contract code versions. This allows the DAO to use a newer, more stable and faster version of the contract code. New versions usually include new features, bug fixes and improvements in performance. Downgrade to an older version is also possible.

There are two major ways to upgrade the DAO:
 - Self upgrade by storing blob on the DAO contract and then voting to UpgradeSelf
 - Upgrade from the factory - factory stores new contract and then, if allowed, it upgrades the DAO by calling `upgrade(code)`.

DAOs can explicitly vote to disable factory auto upgrades and can pull the upgrade themselves from the factory.

`````

## sputnikdao2/src/lib.rs

Source: https://raw.githubusercontent.com/near-daos/sputnik-dao-contract/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/sputnikdao2/src/lib.rs

`````rust
use std::collections::VecDeque;

use near_contract_standards::fungible_token::Balance;
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LazyOption, LookupMap};
use near_sdk::json_types::{Base58CryptoHash, U128};
use near_sdk::{
    AccountId, BorshStorageKey, CryptoHash, NearToken, PanicOnDefault, Promise, PromiseOrValue,
    env, ext_contract, near,
};

use crate::action_log::ActionLog;
pub use crate::bounties::{Bounty, BountyClaim, VersionedBounty};
pub use crate::policy::{
    Policy, RoleKind, RolePermission, VersionedPolicy, VotePolicy, default_policy,
};
use crate::proposals::VersionedProposal;
pub use crate::proposals::{Proposal, ProposalInput, ProposalKind, ProposalStatus};
pub use crate::types::{Action, Config, OLD_BASE_TOKEN, OldAccountId};
use crate::upgrade::{
    ContractV1, FactoryInfo, StateVersion, internal_get_factory_info, internal_set_factory_info,
    state_version_read, state_version_write,
};
pub use crate::views::{BountyOutput, ProposalOutput};

pub mod action_log;
mod bounties;
mod delegation;
mod ext_fungible_token;
mod policy;
pub mod proposals;
mod types;
mod upgrade;
pub mod views;

#[near(serializers=[borsh])]
#[derive(BorshStorageKey)]
pub enum StorageKeys {
    Config,
    Policy,
    Delegations,
    Proposals,
    Bounties,
    BountyClaimers,
    BountyClaimCounts,
    Blobs,
}

/// After payouts, allows a callback
#[ext_contract(ext_self)]
pub trait ExtSelf {
    /// Callback after proposal execution.
    fn on_proposal_callback(&mut self, proposal_id: u64) -> PromiseOrValue<()>;
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// DAO configuration.
    pub config: LazyOption<Config>,
    /// Voting and permissions policy.
    pub policy: LazyOption<VersionedPolicy>,

    /// Amount of $NEAR locked for bonds.
    pub locked_amount: NearToken,

    /// Vote staking contract id. That contract must have this account as owner.
    pub staking_id: Option<AccountId>,
    /// Delegated  token total amount.
    pub total_delegation_amount: Balance,
    /// Delegations per user.
    pub delegations: LookupMap<AccountId, Balance>,

    /// Last available id for the proposals.
    pub last_proposal_id: u64,
    /// Proposal map from ID to proposal information.
    pub proposals: LookupMap<u64, VersionedProposal>,

    /// Last available id for the bounty.
    pub last_bounty_id: u64,
    /// Bounties map from ID to bounty information.
    pub bounties: LookupMap<u64, VersionedBounty>,
    /// Bounty claimers map per user. Allows quickly to query for each users their claims.
    pub bounty_claimers: LookupMap<AccountId, Vec<BountyClaim>>,
    /// Count of claims per bounty.
    pub bounty_claims_count: LookupMap<u64, u32>,

    /// Large blob storage.
    pub blobs: LookupMap<CryptoHash, AccountId>,

    /// Log of the latest actions on proposals
    pub actions_log: VecDeque<ActionLog>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(config: Config, policy: VersionedPolicy) -> Self {
        let this = Self {
            config: LazyOption::new(StorageKeys::Config, Some(&config)),
            policy: LazyOption::new(StorageKeys::Policy, Some(&policy.upgrade())),
            staking_id: None,
            total_delegation_amount: 0,
            delegations: LookupMap::new(StorageKeys::Delegations),
            last_proposal_id: 0,
            proposals: LookupMap::new(StorageKeys::Proposals),
            last_bounty_id: 0,
            bounties: LookupMap::new(StorageKeys::Bounties),
            bounty_claimers: LookupMap::new(StorageKeys::BountyClaimers),
            bounty_claims_count: LookupMap::new(StorageKeys::BountyClaimCounts),
            blobs: LookupMap::new(StorageKeys::Blobs),
            locked_amount: NearToken::from_near(0),
            actions_log: VecDeque::new(),
        };
        internal_set_factory_info(&FactoryInfo {
            factory_id: env::predecessor_account_id(),
            auto_update: true,
        });
        state_version_write(&StateVersion::V2);
        this
    }

    /// Should only be called by this contract on migration.
    /// This is NOOP implementation. KEEP IT if you haven't changed contract state.
    /// If you have changed state, you need to implement migration from old state (keep the old struct with different name to deserialize it first).
    /// After migrate goes live on MainNet, return this implementation for next updates.
    #[private]
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        let version = state_version_read();
        match version {
            StateVersion::V1 => {
                let this: ContractV1 = env::state_read().expect("ERR_CONTRACT_IS_NOT_INITIALIZED");
                state_version_write(&StateVersion::V2);
                Contract {
                    config: this.config,
                    policy: this.policy,
                    locked_amount: this.locked_amount,
                    staking_id: this.staking_id,
                    total_delegation_amount: this.total_delegation_amount,
                    delegations: this.delegations,
                    last_proposal_id: this.last_proposal_id,
                    proposals: this.proposals,
                    last_bounty_id: this.last_bounty_id,
                    bounties: this.bounties,
                    bounty_claimers: this.bounty_claimers,
                    bounty_claims_count: this.bounty_claims_count,
                    blobs: this.blobs,
                    actions_log: VecDeque::new(),
                }
            }
            StateVersion::V2 => env::state_read().expect("ERR_CONTRACT_IS_NOT_INITIALIZED"),
        }
    }

    /// Remove blob from contract storage and pay back to original storer.
    /// Only original storer can call this.
    pub fn remove_blob(&mut self, hash: Base58CryptoHash) -> Promise {
        let hash: CryptoHash = hash.into();
        let account_id = self.blobs.remove(&hash).expect("ERR_NO_BLOB");
        assert_eq!(
            env::predecessor_account_id(),
            account_id,
            "ERR_INVALID_CALLER"
        );
        env::storage_remove(&hash);
        let blob_len = env::register_len(u64::MAX - 1).unwrap();
        let storage_cost = env::storage_byte_cost().saturating_mul((blob_len + 32) as u128);
        Promise::new(account_id).transfer(storage_cost)
    }

    /// Returns factory information, including if auto update is allowed.
    pub fn get_factory_info(&self) -> FactoryInfo {
        internal_get_factory_info()
    }
}

/// Stores attached data into blob store and returns hash of it.
/// Implemented to avoid loading the data into WASM for optimal gas usage.
#[cfg(target_arch = "wasm32")]
#[unsafe(no_mangle)]
pub extern "C" fn store_blob() {
    env::setup_panic_hook();
    let mut contract: Contract = env::state_read().expect("ERR_CONTRACT_IS_NOT_INITIALIZED");
    let input = env::input().expect("ERR_NO_INPUT");
    let sha256_hash = env::sha256(&input);
    assert!(!env::storage_has_key(&sha256_hash), "ERR_ALREADY_EXISTS");

    let blob_len = input.len();
    let storage_cost = env::storage_byte_cost().saturating_mul((blob_len + 32) as u128);
    assert!(
        env::attached_deposit() >= storage_cost,
        "ERR_NOT_ENOUGH_DEPOSIT:{}",
        storage_cost
    );

    env::storage_write(&sha256_hash, &input);
    let mut blob_hash = [0u8; 32];
    blob_hash.copy_from_slice(&sha256_hash);
    contract
        .blobs
        .insert(&blob_hash, &env::predecessor_account_id());
    let blob_hash_str = near_sdk::serde_json::to_string(&Base58CryptoHash::from(blob_hash))
        .unwrap()
        .into_bytes();

    env::value_return(&blob_hash_str);
    env::state_write(&contract);
}

#[cfg(test)]
mod tests {
    use near_api::types::NearToken;
    use near_sdk::test_utils::{VMContextBuilder, accounts};
    use near_sdk::testing_env;

    use crate::action_log::ProposalLog;
    use crate::proposals::ProposalStatus;

    use super::*;

    fn create_proposal(context: &mut VMContextBuilder, contract: &mut Contract) -> u64 {
        testing_env!(context.attached_deposit(NearToken::from_near(1)).build());
        contract.add_proposal(ProposalInput {
            description: "test".to_string(),
            kind: ProposalKind::Transfer {
                token_id: String::from(OLD_BASE_TOKEN),
                receiver_id: accounts(2),
                amount: U128(NearToken::from_near(100).as_yoctonear()),
                msg: None,
            },
        })
    }

    #[test]
    fn test_basics() {
        let mut context = VMContextBuilder::new();
        testing_env!(context.predecessor_account_id(accounts(1)).build());
        let mut contract = Contract::new(
            Config::test_config(),
            VersionedPolicy::Default(vec![accounts(1)]),
        );
        let id = create_proposal(&mut context, &mut contract);
        assert_eq!(contract.get_proposal(id).proposal.description, "test");
        assert_eq!(contract.get_proposals(0, 10).len(), 1);

        let id = create_proposal(&mut context, &mut contract);
        contract.act_proposal(
            id,
            Action::VoteApprove,
            contract.get_proposal(id).proposal.kind,
            None,
        );
        assert_eq!(
            contract.get_proposal(id).proposal.status,
            ProposalStatus::Approved
        );

        let id = create_proposal(&mut context, &mut contract);
        // proposal expired, finalize.
        testing_env!(
            context
                .block_timestamp(1_000_000_000 * 24 * 60 * 60 * 8)
                .build()
        );
        contract.act_proposal(
            id,
            Action::Finalize,
            contract.get_proposal(id).proposal.kind,
            None,
        );
        assert_eq!(
            contract.get_proposal(id).proposal.status,
            ProposalStatus::Expired
        );

        // non council adding proposal per default policy.
        testing_env!(
            context
                .predecessor_account_id(accounts(2))
                .attached_deposit(NearToken::from_near(1))
                .build()
        );
        let _id = contract.add_proposal(ProposalInput {
            description: "test".to_string(),
            kind: ProposalKind::AddMemberToRole {
                member_id: accounts(2),
                role: "council".to_string(),
            },
        });
    }

    #[test]
    #[should_panic(expected = "ERR_PERMISSION_DENIED")]
    fn test_remove_proposal_denied() {
        let mut context = VMContextBuilder::new();
        testing_env!(context.predecessor_account_id(accounts(1)).build());
        let mut contract = Contract::new(
            Config::test_config(),
            VersionedPolicy::Default(vec![accounts(1)]),
        );
        let id = create_proposal(&mut context, &mut contract);
        assert_eq!(contract.get_proposal(id).proposal.description, "test");
        contract.act_proposal(
            id,
            Action::RemoveProposal,
            contract.get_proposal(id).proposal.kind,
            None,
        );
    }

    #[test]
    fn test_remove_proposal_allowed() {
        let mut context = VMContextBuilder::new();
        testing_env!(context.predecessor_account_id(accounts(1)).build());
        let mut policy = VersionedPolicy::Default(vec![accounts(1)]).upgrade();
        policy.to_policy_mut().roles[1]
            .permissions
            .insert("*:RemoveProposal".to_string());
        let mut contract = Contract::new(Config::test_config(), policy);
        let id = create_proposal(&mut context, &mut contract);
        assert_eq!(contract.get_proposal(id).proposal.description, "test");
        contract.act_proposal(
            id,
            Action::RemoveProposal,
            contract.get_proposal(id).proposal.kind,
            None,
        );
        assert_eq!(contract.get_proposals(0, 10).len(), 0);
    }

    #[test]
    fn test_vote_expired_proposal() {
        let mut context = VMContextBuilder::new();
        testing_env!(context.predecessor_account_id(accounts(1)).build());
        let mut contract = Contract::new(
            Config::test_config(),
            VersionedPolicy::Default(vec![accounts(1)]),
        );
        let id = create_proposal(&mut context, &mut contract);
        testing_env!(
            context
                .block_timestamp(1_000_000_000 * 24 * 60 * 60 * 8)
                .build()
        );
        contract.act_proposal(
            id,
            Action::VoteApprove,
            contract.get_proposal(id).proposal.kind,
            None,
        );
    }

    #[test]
    #[should_panic(expected = "ERR_ALREADY_VOTED")]
    fn test_vote_twice() {
        let mut context = VMContextBuilder::new();
        testing_env!(context.predecessor_account_id(accounts(1)).build());
        let mut contract = Contract::new(
            Config::test_config(),
            VersionedPolicy::Default(vec![accounts(1), accounts(2)]),
        );
        let id = create_proposal(&mut context, &mut contract);
        contract.act_proposal(
            id,
            Action::VoteApprove,
            contract.get_proposal(id).proposal.kind,
            None,
        );
        contract.act_proposal(
            id,
            Action::VoteApprove,
            contract.get_proposal(id).proposal.kind,
            None,
        );
    }

    #[test]
    #[should_panic(expected = "ERR_WRONG_KIND")]
    fn test_wrong_kind() {
        let mut context = VMContextBuilder::new();
        testing_env!(context.predecessor_account_id(accounts(1)).build());
        let mut contract = Contract::new(
            Config::test_config(),
            VersionedPolicy::Default(vec![accounts(1), accounts(2)]),
        );
        let id = create_proposal(&mut context, &mut contract);
        contract.act_proposal(
            id,
            Action::VoteApprove,
            ProposalKind::Transfer {
                token_id: String::from(OLD_BASE_TOKEN),
                receiver_id: accounts(1), // The only different thing from initial kind
                amount: U128(NearToken::from_near(100).as_yoctonear()),
                msg: None,
            },
            None,
        );
    }

    #[test]
    fn test_add_to_missing_role() {
        let mut context = VMContextBuilder::new();
        testing_env!(context.predecessor_account_id(accounts(1)).build());
        let mut contract = Contract::new(
            Config::test_config(),
            VersionedPolicy::Default(vec![accounts(1)]),
        );
        testing_env!(context.attached_deposit(NearToken::from_near(1)).build());
        let id = contract.add_proposal(ProposalInput {
            description: "test".to_string(),
            kind: ProposalKind::AddMemberToRole {
                member_id: accounts(2),
                role: "missing".to_string(),
            },
        });
        contract.act_proposal(
            id,
            Action::VoteApprove,
            contract.get_proposal(id).proposal.kind,
            None,
        );
        let x = contract.get_policy();
        // still 2 roles: all and council.
        assert_eq!(x.roles.len(), 2);
    }

    #[test]
    #[should_panic(expected = "ERR_INVALID_POLICY")]
    fn test_fails_adding_invalid_policy() {
        let mut context = VMContextBuilder::new();
        testing_env!(context.predecessor_account_id(accounts(1)).build());
        let mut contract = Contract::new(
            Config::test_config(),
            VersionedPolicy::Default(vec![accounts(1)]),
        );
        testing_env!(context.attached_deposit(NearToken::from_near(1)).build());
        let _id = contract.add_proposal(ProposalInput {
            description: "test".to_string(),
            kind: ProposalKind::ChangePolicy {
                policy: VersionedPolicy::Default(vec![]),
            },
        });
    }

    #[test]
    fn test_action_log() {
        let mut context = VMContextBuilder::new();
        testing_env!(context.predecessor_account_id(accounts(0)).build());
        let accounts_list: Vec<AccountId> = [
            "alice", "bob", "charlie", "danny", "eugene", "fargo", "grace", "hannah", "ian",
            "julia", "kevin", "linda", "michael", "nathan", "olivia", "patricia", "quinn",
            "robert", "sarah", "thomas", "ursula", "victor", "wendy", "xavier", "yasmine", "zack",
            "adam", "bella", "cameron", "diana", "ethan", "fiona", "george", "heidi", "isaac",
            "jennifer", "kyle", "lily", "marcus", "nina", "oscar", "penelope", "quincy", "ryan",
            "sophia", "tyler", "uma", "vincent", "willow", "xander",
        ]
        .iter()
        .map(|name| name.parse().unwrap())
        .collect();
        let mut contract = Contract::new(
            Config::test_config(),
            VersionedPolicy::Default(accounts_list.clone()),
        );
        let id = create_proposal(&mut context, &mut contract);

        // Check that last actions log has proposal create
        let proposal = contract.get_proposal(id).proposal;
        let proposal_kind = contract.get_proposal(id).proposal.kind;
        let proposal_last_actions_log = proposal.last_actions_log;
        let global_last_actions_log = contract.get_actions_log();
        assert_eq!(proposal_last_actions_log.len(), 1);
        assert_eq!(global_last_actions_log.len(), 1);
        assert_eq!(
            proposal_last_actions_log[0],
            ProposalLog {
                block_height: 0.into()
            }
        );
        assert_eq!(
            global_last_actions_log[0],
            ActionLog {
                account_id: "alice".parse().unwrap(),
                proposal_id: 0.into(),
                action: Action::AddProposal,
                block_height: 0.into()
            }
        );

        // Fill the latest actions list
        for i in 1..21 {
            testing_env!(
                context
                    .predecessor_account_id(accounts_list.get(i).unwrap().clone())
                    .build()
            );
            contract.act_proposal(id, Action::VoteApprove, proposal_kind.clone(), None);
        }
        // Now the oldest proposal should be bob's vote
        let proposal_last_actions_log = contract.get_proposal(id).proposal.last_actions_log;
        let global_last_actions_log = contract.get_actions_log();
        assert_eq!(proposal_last_actions_log.len(), 20);
        assert_eq!(global_last_actions_log.len(), 20);
        assert_eq!(
            proposal_last_actions_log[0],
            ProposalLog {
                block_height: 0.into()
            }
        );
        assert_eq!(
            global_last_actions_log[0],
            ActionLog {
                account_id: "bob".parse().unwrap(),
                proposal_id: 0.into(),
                action: Action::VoteApprove,
                block_height: 0.into()
            }
        );
    }
}

`````

## sputnikdao2/src/types.rs

Source: https://raw.githubusercontent.com/near-daos/sputnik-dao-contract/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/sputnikdao2/src/types.rs

`````rust
use near_sdk::json_types::Base64VecU8;
use near_sdk::{AccountId, Gas, NearToken, near};

/// Account ID used for $NEAR in near-sdk v3.
/// Need to keep it around for backward compatibility.
pub const OLD_BASE_TOKEN: &str = "";

/// Account ID that represents a token in near-sdk v3.
/// Need to keep it around for backward compatibility.
pub type OldAccountId = String;

/// 1 yN to prevent access key fraud.
pub const ONE_YOCTO_NEAR: NearToken = NearToken::from_yoctonear(1);

/// Gas for single ft_transfer call.
pub const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(10);

/// Configuration of the DAO.
#[derive(Clone, Debug, PartialEq)]
#[near(serializers=[borsh, json])]
#[serde(deny_unknown_fields)]
pub struct Config {
    /// Name of the DAO.
    pub name: String,
    /// Purpose of this DAO.
    pub purpose: String,
    /// Generic metadata. Can be used by specific UI to store additional data.
    /// This is not used by anything in the contract.
    pub metadata: Base64VecU8,
}

#[cfg(test)]
impl Config {
    pub fn test_config() -> Self {
        Self {
            name: "Test".to_string(),
            purpose: "to test".to_string(),
            metadata: Base64VecU8(vec![]),
        }
    }
}

/// Set of possible action to take.
#[derive(Clone, Debug)]
#[near(serializers=[borsh, json])]
#[cfg_attr(not(target_arch = "wasm32"), derive(PartialEq))]
pub enum Action {
    /// Action to add proposal. Used internally.
    AddProposal,
    /// Action to remove given proposal. Used for immediate deletion in special cases.
    RemoveProposal,
    /// Vote to approve given proposal or bounty.
    VoteApprove,
    /// Vote to reject given proposal or bounty.
    VoteReject,
    /// Vote to remove given proposal or bounty (because it's spam).
    VoteRemove,
    /// Finalize proposal, called when it's expired to return the funds
    /// (or in the future can be used for early proposal closure).
    Finalize,
    /// Move a proposal to the hub to shift into another DAO.
    MoveToHub,
}

impl Action {
    pub fn to_policy_label(&self) -> String {
        format!("{:?}", self)
    }
}

/// In near-sdk v3, the token was represented by a String, with no other restrictions.
/// That being said, Sputnik used "" (empty String) as a convention to represent the $NEAR token.
/// In near-sdk v4, the token representation was replaced by AccountId (which is in fact a wrapper
/// over a String), with the restriction that the token must be between 2 and 64 chars.
/// Sputnik had to adapt since "" was not allowed anymore and we chose to represent the token as a
/// Option<AccountId> with the convention that None represents the $NEAR token.
/// This function is required to help with the transition and keep the backward compatibility.
pub fn convert_old_to_new_token(old_account_id: &OldAccountId) -> Option<AccountId> {
    if old_account_id == OLD_BASE_TOKEN {
        return None;
    }
    Some(old_account_id.clone().parse().unwrap())
}

`````

## sputnikdao2/src/views.rs

Source: https://raw.githubusercontent.com/near-daos/sputnik-dao-contract/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/sputnikdao2/src/views.rs

`````rust
use std::cmp::min;

use crate::*;

/// This is format of output via JSON for the proposal.
#[near(serializers=[borsh, json])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
pub struct ProposalOutput {
    /// Id of the proposal.
    pub id: u64,
    #[serde(flatten)]
    pub proposal: Proposal,
}

/// This is format of output via JSON for the bounty.
#[near(serializers=[borsh, json])]
pub struct BountyOutput {
    /// Id of the bounty.
    pub id: u64,
    #[serde(flatten)]
    pub bounty: Bounty,
}

#[near]
impl Contract {
    /// Returns semver of this contract.
    pub fn version(&self) -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }

    /// Returns config of this contract.
    pub fn get_config(&self) -> Config {
        self.config.get().unwrap().clone()
    }

    /// Returns policy of this contract.
    pub fn get_policy(&self) -> Policy {
        self.policy.get().unwrap().to_policy().clone()
    }

    /// Returns staking contract if available. Otherwise returns empty.
    pub fn get_staking_contract(self) -> String {
        self.staking_id.map(String::from).unwrap_or_default()
    }

    /// Returns if blob with given hash is stored.
    pub fn has_blob(&self, hash: Base58CryptoHash) -> bool {
        env::storage_has_key(&CryptoHash::from(hash))
    }

    /// Returns locked amount of NEAR that is used for storage.
    pub fn get_locked_storage_amount(&self) -> NearToken {
        env::storage_byte_cost().saturating_mul(env::storage_usage().into())
    }

    /// Returns available amount of NEAR that can be spent (outside of amount for storage and bonds).
    pub fn get_available_amount(&self) -> NearToken {
        env::account_balance()
            .saturating_sub(self.get_locked_storage_amount())
            .saturating_sub(self.locked_amount)
    }

    /// Returns total delegated stake.
    pub fn delegation_total_supply(&self) -> U128 {
        U128(self.total_delegation_amount)
    }

    /// Returns delegated stake to given account.
    pub fn delegation_balance_of(&self, account_id: AccountId) -> U128 {
        U128(self.delegations.get(&account_id).unwrap_or_default())
    }

    /// Combines balance and total amount for calling from external contracts.
    pub fn delegation_balance_ratio(&self, account_id: AccountId) -> (U128, U128) {
        (
            self.delegation_balance_of(account_id),
            self.delegation_total_supply(),
        )
    }

    /// Last proposal's id.
    pub fn get_last_proposal_id(&self) -> u64 {
        self.last_proposal_id
    }

    /// Get proposals in paginated view.
    pub fn get_proposals(&self, from_index: u64, limit: u64) -> Vec<ProposalOutput> {
        (from_index..min(self.last_proposal_id, from_index + limit))
            .filter_map(|id| {
                self.proposals.get(&id).map(|proposal| ProposalOutput {
                    id,
                    proposal: proposal.into(),
                })
            })
            .collect()
    }

    /// Get specific proposal.
    pub fn get_proposal(&self, id: u64) -> ProposalOutput {
        let proposal = self.proposals.get(&id).expect("ERR_NO_PROPOSAL");
        ProposalOutput {
            id,
            proposal: proposal.into(),
        }
    }

    /// Get given bounty by id.
    pub fn get_bounty(&self, id: u64) -> BountyOutput {
        let bounty = self.bounties.get(&id).expect("ERR_NO_BOUNTY");
        BountyOutput {
            id,
            bounty: bounty.into(),
        }
    }

    /// Get number of bounties.
    pub fn get_last_bounty_id(&self) -> u64 {
        self.last_bounty_id
    }

    /// Get `limit` of bounties from given index.
    pub fn get_bounties(&self, from_index: u64, limit: u64) -> Vec<BountyOutput> {
        (from_index..std::cmp::min(from_index + limit, self.last_bounty_id))
            .filter_map(|id| {
                self.bounties.get(&id).map(|bounty| BountyOutput {
                    id,
                    bounty: bounty.into(),
                })
            })
            .collect()
    }

    /// Get bounty claims for given user.
    pub fn get_bounty_claims(&self, account_id: AccountId) -> Vec<BountyClaim> {
        self.bounty_claimers.get(&account_id).unwrap_or_default()
    }

    /// Returns number of claims per given bounty.
    pub fn get_bounty_number_of_claims(&self, id: u64) -> u32 {
        self.bounty_claims_count.get(&id).unwrap_or_default()
    }

    pub fn get_actions_log(&self) -> &VecDeque<ActionLog> {
        &self.actions_log
    }
}

`````

## sputnikdao2/src/policy.rs

Source: https://raw.githubusercontent.com/near-daos/sputnik-dao-contract/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/sputnikdao2/src/policy.rs

`````rust
use std::cmp::min;
use std::collections::{HashMap, HashSet};

use near_contract_standards::fungible_token::Balance;
use near_sdk::json_types::{U64, U128};
use near_sdk::{AccountId, NearToken, env, near};

use crate::proposals::{PolicyParameters, Proposal, ProposalKind, ProposalStatus, Vote};
use crate::types::Action;

#[derive(Clone, PartialEq)]
#[near(serializers=[json,borsh])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
#[serde(deny_unknown_fields)]
pub enum RoleKind {
    /// Matches everyone, who is not matched by other roles.
    Everyone,
    /// Member greater or equal than given balance. Can use `1` as non-zero balance.
    Member(U128),
    /// Set of accounts.
    Group(HashSet<AccountId>),
}

impl RoleKind {
    /// Checks if user matches given role.
    pub fn match_user(&self, user: &UserInfo) -> bool {
        match self {
            RoleKind::Everyone => true,
            RoleKind::Member(amount) => user.amount >= amount.0,
            RoleKind::Group(accounts) => accounts.contains(&user.account_id),
        }
    }

    /// Returns the number of people in the this role or None if not supported role kind.
    pub fn get_role_size(&self) -> Option<usize> {
        match self {
            RoleKind::Group(accounts) => Some(accounts.len()),
            _ => None,
        }
    }

    #[allow(clippy::result_unit_err)]
    pub fn add_member_to_group(&mut self, member_id: &AccountId) -> Result<(), ()> {
        match self {
            RoleKind::Group(accounts) => {
                accounts.insert(member_id.clone());
                Ok(())
            }
            _ => Err(()),
        }
    }

    #[allow(clippy::result_unit_err)]
    pub fn remove_member_from_group(&mut self, member_id: &AccountId) -> Result<(), ()> {
        match self {
            RoleKind::Group(accounts) => {
                accounts.remove(member_id);
                Ok(())
            }
            _ => Err(()),
        }
    }
}

#[derive(Clone, PartialEq)]
#[near(serializers=[json,borsh])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
#[serde(deny_unknown_fields)]
pub struct RolePermission {
    /// Name of the role to display to the user.
    pub name: String,
    /// Kind of the role: defines which users this permissions apply.
    pub kind: RoleKind,
    /// Set of actions on which proposals that this role is allowed to execute.
    /// <proposal_kind>:<action>
    pub permissions: HashSet<String>,
    /// For each proposal kind, defines voting policy.
    pub vote_policy: HashMap<String, VotePolicy>,
}

pub struct UserInfo {
    pub account_id: AccountId,
    pub amount: Balance,
}

/// Direct weight or ratio to total weight, used for the voting policy.
#[derive(Clone, PartialEq)]
#[near(serializers=[borsh, json])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
#[serde(untagged)]
pub enum WeightOrRatio {
    Weight(U128),
    Ratio(u64, std::num::NonZeroU64),
}

impl WeightOrRatio {
    /// Convert weight or ratio to specific weight given total weight.
    pub fn to_weight(&self, total_weight: Balance) -> Balance {
        match self {
            WeightOrRatio::Weight(weight) => min(weight.0, total_weight),
            WeightOrRatio::Ratio(num, denom) => min(
                (u128::from(*num) * total_weight) / u128::from(denom.get()) + 1,
                total_weight,
            ),
        }
    }
}

/// How the voting policy votes get weigthed.
#[derive(Clone, PartialEq)]
#[near(serializers=[json,borsh])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
pub enum WeightKind {
    /// Using token amounts and total delegated at the moment.
    TokenWeight,
    /// Weight of the group role. Roles that don't have scoped group are not supported.
    RoleWeight,
}

/// Defines configuration of the vote.
#[derive(Clone, PartialEq)]
#[near(serializers=[json,borsh])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
#[serde(deny_unknown_fields)]
pub struct VotePolicy {
    /// Kind of weight to use for votes.
    pub weight_kind: WeightKind,
    /// Minimum number required for vote to finalize.
    /// If weight kind is TokenWeight - this is minimum number of tokens required.
    ///     This allows to avoid situation where the number of staked tokens from total supply is too small.
    /// If RoleWeight - this is minimum number of votes.
    ///     This allows to avoid situation where the role is got too small but policy kept at 1/2, for example.
    pub quorum: U128,
    /// How many votes to pass this vote.
    pub threshold: WeightOrRatio,
}

impl Default for VotePolicy {
    fn default() -> Self {
        VotePolicy {
            weight_kind: WeightKind::RoleWeight,
            quorum: U128(0),
            threshold: WeightOrRatio::Ratio(1, std::num::NonZeroU64::new(2).unwrap()),
        }
    }
}

/// Defines voting / decision making policy of this DAO.
#[derive(Clone, PartialEq)]
#[near(serializers=[json,borsh])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
#[serde(deny_unknown_fields)]
pub struct Policy {
    /// List of roles and permissions for them in the current policy.
    pub roles: Vec<RolePermission>,
    /// Default vote policy. Used when given proposal kind doesn't have special policy.
    pub default_vote_policy: VotePolicy,
    /// Proposal bond.
    pub proposal_bond: NearToken,
    /// Expiration period for proposals.
    pub proposal_period: U64,
    /// Bond for claiming a bounty.
    pub bounty_bond: NearToken,
    /// Period in which giving up on bounty is not punished.
    pub bounty_forgiveness_period: U64,
}

/// Versioned policy.
#[derive(Clone, PartialEq)]
#[near(serializers = [borsh, json])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
#[serde(untagged, deny_unknown_fields)]
pub enum VersionedPolicy {
    /// Default policy with given accounts as council.
    Default(Vec<AccountId>),
    Current(Policy),
}

/// Defines default policy:
///     - everyone can add proposals
///     - group consisting of the call can do all actions, consists of caller.
///     - non token weighted voting, requires 1/2 of the group to vote
///     - proposal & bounty bond is 1N
///     - proposal & bounty forgiveness period is 1 day
pub fn default_policy(council: Vec<AccountId>) -> Policy {
    Policy {
        roles: vec![
            RolePermission {
                name: "all".to_string(),
                kind: RoleKind::Everyone,
                permissions: vec!["*:AddProposal".to_string()].into_iter().collect(),
                vote_policy: HashMap::default(),
            },
            RolePermission {
                name: "council".to_string(),
                kind: RoleKind::Group(council.into_iter().collect()),
                // All actions except RemoveProposal are allowed by council.
                permissions: vec![
                    "*:AddProposal".to_string(),
                    "*:VoteApprove".to_string(),
                    "*:VoteReject".to_string(),
                    "*:VoteRemove".to_string(),
                    "*:Finalize".to_string(),
                ]
                .into_iter()
                .collect(),
                vote_policy: HashMap::default(),
            },
        ],
        default_vote_policy: VotePolicy::default(),
        proposal_bond: NearToken::from_near(1),
        proposal_period: U64::from(1_000_000_000 * 60 * 60 * 24 * 7),
        bounty_bond: NearToken::from_near(1),
        bounty_forgiveness_period: U64::from(1_000_000_000 * 60 * 60 * 24),
    }
}

impl VersionedPolicy {
    /// Upgrades either version of policy into the latest.
    pub fn upgrade(self) -> Self {
        match self {
            VersionedPolicy::Default(accounts) => {
                VersionedPolicy::Current(default_policy(accounts))
            }
            VersionedPolicy::Current(policy) => VersionedPolicy::Current(policy),
        }
    }

    /// Return recent version of policy.
    pub fn to_policy(self) -> Policy {
        match self {
            VersionedPolicy::Current(policy) => policy,
            _ => unimplemented!(),
        }
    }

    pub fn to_policy_mut(&mut self) -> &mut Policy {
        match self {
            VersionedPolicy::Current(policy) => policy,
            _ => unimplemented!(),
        }
    }
}

impl Policy {
    pub fn add_or_update_role(&mut self, role: &RolePermission) {
        for i in 0..self.roles.len() {
            if self.roles[i].name == role.name {
                env::log_str(&format!(
                    "Updating existing role in the policy:{}",
                    &role.name
                ));
                let _ = std::mem::replace(&mut self.roles[i], role.clone());
                return;
            }
        }
        env::log_str(&format!("Adding new role to the policy:{}", &role.name));
        self.roles.push(role.clone());
    }

    pub fn remove_role(&mut self, role: &String) {
        for i in 0..self.roles.len() {
            if &self.roles[i].name == role {
                self.roles.remove(i);
                return;
            }
        }
        env::log_str(&format!("ERR_ROLE_NOT_FOUND:{}", role));
    }

    pub fn update_default_vote_policy(&mut self, vote_policy: &VotePolicy) {
        self.default_vote_policy = vote_policy.clone();
        env::log_str("Successfully updated the default vote policy.");
    }

    pub fn update_parameters(&mut self, parameters: &PolicyParameters) {
        if parameters.proposal_bond.is_some() {
            self.proposal_bond = parameters.proposal_bond.unwrap();
        }
        if parameters.proposal_period.is_some() {
            self.proposal_period = parameters.proposal_period.unwrap();
        }
        if parameters.bounty_bond.is_some() {
            self.bounty_bond = parameters.bounty_bond.unwrap();
        }
        if parameters.bounty_forgiveness_period.is_some() {
            self.bounty_forgiveness_period = parameters.bounty_forgiveness_period.unwrap();
        }
        env::log_str("Successfully updated the policy parameters.");
    }

    pub fn add_member_to_role(&mut self, role: &String, member_id: &AccountId) {
        for i in 0..self.roles.len() {
            if &self.roles[i].name == role {
                self.roles[i]
                    .kind
                    .add_member_to_group(member_id)
                    .unwrap_or_else(|()| {
                        env::log_str(&format!("ERR_ROLE_WRONG_KIND:{}", role));
                    });
                return;
            }
        }
        env::log_str(&format!("ERR_ROLE_NOT_FOUND:{}", role));
    }

    pub fn remove_member_from_role(&mut self, role: &String, member_id: &AccountId) {
        for i in 0..self.roles.len() {
            if &self.roles[i].name == role {
                self.roles[i]
                    .kind
                    .remove_member_from_group(member_id)
                    .unwrap_or_else(|()| {
                        env::log_str(&format!("ERR_ROLE_WRONG_KIND:{}", role));
                    });
                return;
            }
        }
        env::log_str(&format!("ERR_ROLE_NOT_FOUND:{}", role));
    }

    /// Returns set of roles that this user is member of permissions for given user across all the roles it's member of.
    fn get_user_roles(&self, user: UserInfo) -> HashMap<String, &HashSet<String>> {
        let mut roles = HashMap::default();
        for role in self.roles.iter() {
            if role.kind.match_user(&user) {
                roles.insert(role.name.clone(), &role.permissions);
            }
        }
        roles
    }

    /// Can given user execute given action on this proposal.
    /// Returns all roles that allow this action.
    pub fn can_execute_action(
        &self,
        user: UserInfo,
        proposal_kind: &ProposalKind,
        action: &Action,
    ) -> (Vec<String>, bool) {
        let roles = self.get_user_roles(user);
        let mut allowed = false;
        let allowed_roles = roles
            .into_iter()
            .filter_map(|(role, permissions)| {
                let allowed_role = permissions.contains(&format!(
                    "{}:{}",
                    proposal_kind.to_policy_label(),
                    action.to_policy_label()
                )) || permissions
                    .contains(&format!("{}:*", proposal_kind.to_policy_label()))
                    || permissions.contains(&format!("*:{}", action.to_policy_label()))
                    || permissions.contains("*:*");
                allowed = allowed || allowed_role;
                if allowed_role { Some(role) } else { None }
            })
            .collect();
        (allowed_roles, allowed)
    }

    /// Returns if given proposal kind is token weighted.
    pub fn is_token_weighted(&self, role: &String, proposal_kind_label: &String) -> bool {
        let role_info = self.internal_get_role(role).expect("ERR_ROLE_NOT_FOUND");
        matches!(
            role_info
                .vote_policy
                .get(proposal_kind_label)
                .unwrap_or(&self.default_vote_policy)
                .weight_kind,
            WeightKind::TokenWeight
        )
    }

    fn internal_get_role(&self, name: &String) -> Option<&RolePermission> {
        self.roles.iter().find(|role| &role.name == name)
    }

    /// Get proposal status for given proposal.
    /// Usually is called after changing it's state.
    pub fn proposal_status(
        &self,
        proposal: &Proposal,
        roles: Vec<String>,
        total_supply: Balance,
    ) -> ProposalStatus {
        assert!(
            matches!(
                proposal.status,
                ProposalStatus::InProgress | ProposalStatus::Failed
            ),
            "ERR_PROPOSAL_NOT_IN_PROGRESS"
        );
        if proposal.submission_time.0 + self.proposal_period.0 < env::block_timestamp() {
            // Proposal expired.
            return ProposalStatus::Expired;
        };
        for role in roles {
            let role_info = self.internal_get_role(&role).expect("ERR_MISSING_ROLE");
            let vote_policy = role_info
                .vote_policy
                .get(proposal.kind.to_policy_label())
                .unwrap_or(&self.default_vote_policy);
            let total_weight = match &role_info.kind {
                // Skip role that covers everyone as it doesn't provide a total size.
                RoleKind::Everyone => continue,
                RoleKind::Group(group) => {
                    if vote_policy.weight_kind == WeightKind::RoleWeight {
                        group.len() as Balance
                    } else {
                        total_supply
                    }
                }
                RoleKind::Member(_) => total_supply,
            };
            let threshold = U128::from(std::cmp::max(
                vote_policy.quorum.0,
                vote_policy.threshold.to_weight(total_weight),
            ));
            let proposal_data = proposal;
            // Check if there is anything voted above the threshold specified by policy for given role.
            let defaults = [U128::from(0); 3];
            let vote_counts = proposal_data.vote_counts.get(&role).unwrap_or(&defaults);
            if vote_counts[Vote::Approve as usize] >= threshold {
                return ProposalStatus::Approved;
            } else if vote_counts[Vote::Reject as usize] >= threshold {
                return ProposalStatus::Rejected;
            } else if vote_counts[Vote::Remove as usize] >= threshold {
                return ProposalStatus::Removed;
            } else {
                // continue to next role.
            }
        }
        proposal.status.clone()
    }
}

#[cfg(test)]
mod tests {
    use near_sdk::test_utils::accounts;

    use super::*;

    #[test]
    fn test_vote_policy() {
        let r1 = WeightOrRatio::Weight(U128(100));
        assert_eq!(r1.to_weight(1_000_000), 100);
        let r2 = WeightOrRatio::Ratio(1, std::num::NonZeroU64::new(2).unwrap());
        assert_eq!(r2.to_weight(2), 2);
        let r2 = WeightOrRatio::Ratio(1, std::num::NonZeroU64::new(2).unwrap());
        assert_eq!(r2.to_weight(5), 3);
        let r2 = WeightOrRatio::Ratio(1, std::num::NonZeroU64::new(1).unwrap());
        assert_eq!(r2.to_weight(5), 5);
    }

    #[test]
    fn test_add_role() {
        let council = vec![accounts(0), accounts(1)];
        let mut policy = default_policy(council);

        let community_role = policy.internal_get_role(&String::from("community"));
        assert!(community_role.is_none());

        let name: String = "community".to_string();
        let kind: RoleKind = RoleKind::Group(vec![accounts(2), accounts(3)].into_iter().collect());
        let permissions: HashSet<String> = vec!["*:*".to_string()].into_iter().collect();
        let vote_policy: HashMap<String, VotePolicy> = HashMap::default();
        let new_role = RolePermission {
            name: name.clone(),
            kind: kind.clone(),
            permissions: permissions.clone(),
            vote_policy: vote_policy.clone(),
        };
        assert_eq!(2, policy.roles.len());
        policy.add_or_update_role(&new_role);
        assert_eq!(3, policy.roles.len());

        let community_role = policy.internal_get_role(&String::from("community"));
        assert!(community_role.is_some());

        let community_role = community_role.unwrap();
        assert_eq!(name, community_role.name);
        assert_eq!(kind, community_role.kind);
        assert_eq!(permissions, community_role.permissions);
        assert_eq!(vote_policy, community_role.vote_policy);
    }

    #[test]
    fn test_update_role() {
        let council = vec![accounts(0), accounts(1)];
        let mut policy = default_policy(council);

        let name: String = "council".to_string();
        let kind: RoleKind = RoleKind::Group(vec![accounts(0), accounts(1)].into_iter().collect());
        let permissions: HashSet<String> = vec![
            "*:AddProposal".to_string(),
            "*:VoteApprove".to_string(),
            "*:VoteReject".to_string(),
            "*:VoteRemove".to_string(),
            "*:Finalize".to_string(),
        ]
        .into_iter()
        .collect();
        let vote_policy: HashMap<String, VotePolicy> = HashMap::default();

        let council_role = policy.internal_get_role(&String::from("council"));
        assert!(council_role.is_some());

        let council_role = council_role.unwrap();
        assert_eq!(name, council_role.name);
        assert_eq!(kind, council_role.kind);
        assert_eq!(permissions, council_role.permissions);
        assert_eq!(vote_policy, council_role.vote_policy);

        let kind: RoleKind = RoleKind::Group(vec![accounts(2), accounts(3)].into_iter().collect());
        let permissions: HashSet<String> = vec!["*:*".to_string()].into_iter().collect();
        let updated_role = RolePermission {
            name: name.clone(),
            kind: kind.clone(),
            permissions: permissions.clone(),
            vote_policy: vote_policy.clone(),
        };
        assert_eq!(2, policy.roles.len());
        policy.add_or_update_role(&updated_role);
        assert_eq!(2, policy.roles.len());

        let council_role = policy.internal_get_role(&String::from("council"));
        assert!(council_role.is_some());

        let council_role = council_role.unwrap();
        assert_eq!(name, council_role.name);
        assert_eq!(kind, council_role.kind);
        assert_eq!(permissions, council_role.permissions);
        assert_eq!(vote_policy, council_role.vote_policy);
    }

    #[test]
    fn test_remove_role() {
        let council = vec![accounts(0), accounts(1)];
        let mut policy = default_policy(council);

        let council_role = policy.internal_get_role(&String::from("council"));
        assert!(council_role.is_some());
        assert_eq!(2, policy.roles.len());

        policy.remove_role(&String::from("council"));

        let council_role = policy.internal_get_role(&String::from("council"));
        assert!(council_role.is_none());
        assert_eq!(1, policy.roles.len());
    }

    #[test]
    fn test_update_default_vote_policy() {
        let council = vec![accounts(0), accounts(1)];
        let mut policy = default_policy(council);

        assert_eq!(
            WeightKind::RoleWeight,
            policy.default_vote_policy.weight_kind
        );
        assert_eq!(U128(0), policy.default_vote_policy.quorum);
        assert_eq!(
            WeightOrRatio::Ratio(1, std::num::NonZeroU64::new(2).unwrap()),
            policy.default_vote_policy.threshold
        );

        let new_default_vote_policy = VotePolicy {
            weight_kind: WeightKind::TokenWeight,
            quorum: U128(100),
            threshold: WeightOrRatio::Ratio(1, std::num::NonZeroU64::new(4).unwrap()),
        };
        policy.update_default_vote_policy(&new_default_vote_policy);
        assert_eq!(
            new_default_vote_policy.weight_kind,
            policy.default_vote_policy.weight_kind
        );
        assert_eq!(
            new_default_vote_policy.quorum,
            policy.default_vote_policy.quorum
        );
        assert_eq!(
            new_default_vote_policy.threshold,
            policy.default_vote_policy.threshold
        );
    }

    #[test]
    fn test_update_parameters() {
        let council = vec![accounts(0), accounts(1)];
        let mut policy = default_policy(council);

        assert_eq!(NearToken::from_near(1), policy.proposal_bond);
        assert_eq!(
            U64::from(1_000_000_000 * 60 * 60 * 24 * 7),
            policy.proposal_period
        );
        assert_eq!(NearToken::from_near(1), policy.bounty_bond);
        assert_eq!(
            U64::from(1_000_000_000 * 60 * 60 * 24),
            policy.bounty_forgiveness_period
        );

        let new_parameters = PolicyParameters {
            proposal_bond: Some(NearToken::from_near(100)),
            proposal_period: None,
            bounty_bond: None,
            bounty_forgiveness_period: Some(U64::from(1_000_000_000 * 60 * 60 * 24 * 5)),
        };
        policy.update_parameters(&new_parameters);
        assert_eq!(NearToken::from_near(100), policy.proposal_bond);
        assert_eq!(
            U64::from(1_000_000_000 * 60 * 60 * 24 * 7),
            policy.proposal_period
        );
        assert_eq!(NearToken::from_near(1), policy.bounty_bond);
        assert_eq!(
            U64::from(1_000_000_000 * 60 * 60 * 24 * 5),
            policy.bounty_forgiveness_period
        );
    }
}

`````

## sputnikdao2/src/proposals.rs

Source: https://raw.githubusercontent.com/near-daos/sputnik-dao-contract/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/sputnikdao2/src/proposals.rs

`````rust
use std::collections::{HashMap, VecDeque};

use ext_fungible_token::ext_fungible_token;
use near_sdk::json_types::{Base64VecU8, U64, U128};
use near_sdk::{AccountId, Gas, NearToken, PromiseOrValue, log, utils};

use crate::action_log::ProposalLog;
use crate::policy::UserInfo;
use crate::types::{
    Action, Config, GAS_FOR_FT_TRANSFER, OLD_BASE_TOKEN, ONE_YOCTO_NEAR, OldAccountId,
    convert_old_to_new_token,
};
use crate::upgrade::{upgrade_remote, upgrade_using_factory};
use crate::*;

/// Status of a proposal.
#[derive(Clone, PartialEq, Debug)]
#[near(serializers=[borsh, json])]
pub enum ProposalStatus {
    InProgress,
    /// If quorum voted yes, this proposal is successfully approved.
    Approved,
    /// If quorum voted no, this proposal is rejected. Bond is returned.
    Rejected,
    /// If quorum voted to remove (e.g. spam), this proposal is rejected and bond is not returned.
    /// Interfaces shouldn't show removed proposals.
    Removed,
    /// Expired after period of time.
    Expired,
    /// If proposal was moved to Hub or somewhere else.
    Moved,
    /// If proposal has failed when finalizing. Allowed to re-finalize again to either expire or approved.
    Failed,
}

/// Function call arguments.

#[derive(PartialEq, Clone)]
#[near(serializers=[borsh, json])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
#[serde(deny_unknown_fields)]
pub struct ActionCall {
    method_name: String,
    args: Base64VecU8,
    deposit: NearToken,
    gas: Gas,
}

/// Function call arguments.

#[derive(PartialEq, Clone)]
#[near(serializers=[borsh, json])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
#[serde(deny_unknown_fields)]
pub struct PolicyParameters {
    pub proposal_bond: Option<NearToken>,
    pub proposal_period: Option<U64>,
    pub bounty_bond: Option<NearToken>,
    pub bounty_forgiveness_period: Option<U64>,
}

/// Kinds of proposals, doing different action.
#[derive(PartialEq, Clone)]
#[near(serializers=[borsh, json])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
#[serde(deny_unknown_fields)]
pub enum ProposalKind {
    /// Change the DAO config.
    ChangeConfig { config: Config },
    /// Change the full policy.
    ChangePolicy { policy: VersionedPolicy },
    /// Add member to given role in the policy. This is short cut to updating the whole policy.
    AddMemberToRole { member_id: AccountId, role: String },
    /// Remove member to given role in the policy. This is short cut to updating the whole policy.
    RemoveMemberFromRole { member_id: AccountId, role: String },
    /// Calls `receiver_id` with list of method names in a single promise.
    /// Allows this contract to execute any arbitrary set of actions in other contracts.
    FunctionCall {
        receiver_id: AccountId,
        actions: Vec<ActionCall>,
    },
    /// Upgrade this contract with given hash from blob store.
    UpgradeSelf { hash: Base58CryptoHash },
    /// Upgrade another contract, by calling method with the code from given hash from blob store.
    UpgradeRemote {
        receiver_id: AccountId,
        method_name: String,
        hash: Base58CryptoHash,
    },
    /// Transfers given amount of `token_id` from this DAO to `receiver_id`.
    /// If `msg` is not None, calls `ft_transfer_call` with given `msg`. Fails if this base token.
    /// For `ft_transfer` and `ft_transfer_call` `memo` is the `description` of the proposal.
    Transfer {
        /// Can be "" for $NEAR or a valid account id.
        token_id: OldAccountId,
        receiver_id: AccountId,
        amount: U128,
        msg: Option<String>,
    },
    /// Sets staking contract. Can only be proposed if staking contract is not set yet.
    SetStakingContract { staking_id: AccountId },
    /// Add new bounty.
    AddBounty { bounty: Bounty },
    /// Indicates that given bounty is done by given user.
    BountyDone {
        bounty_id: u64,
        receiver_id: AccountId,
    },
    /// Just a signaling vote, with no execution.
    Vote,
    /// Change information about factory and auto update.
    FactoryInfoUpdate { factory_info: FactoryInfo },
    /// Add new role to the policy. If the role already exists, update it. This is short cut to updating the whole policy.
    ChangePolicyAddOrUpdateRole { role: RolePermission },
    /// Remove role from the policy. This is short cut to updating the whole policy.
    ChangePolicyRemoveRole { role: String },
    /// Update the default vote policy from the policy. This is short cut to updating the whole policy.
    ChangePolicyUpdateDefaultVotePolicy { vote_policy: VotePolicy },
    /// Update the parameters from the policy. This is short cut to updating the whole policy.
    ChangePolicyUpdateParameters { parameters: PolicyParameters },
}

impl ProposalKind {
    /// Returns label of policy for given type of proposal.
    pub fn to_policy_label(&self) -> &str {
        match self {
            ProposalKind::ChangeConfig { .. } => "config",
            ProposalKind::ChangePolicy { .. } => "policy",
            ProposalKind::AddMemberToRole { .. } => "add_member_to_role",
            ProposalKind::RemoveMemberFromRole { .. } => "remove_member_from_role",
            ProposalKind::FunctionCall { .. } => "call",
            ProposalKind::UpgradeSelf { .. } => "upgrade_self",
            ProposalKind::UpgradeRemote { .. } => "upgrade_remote",
            ProposalKind::Transfer { .. } => "transfer",
            ProposalKind::SetStakingContract { .. } => "set_vote_token",
            ProposalKind::AddBounty { .. } => "add_bounty",
            ProposalKind::BountyDone { .. } => "bounty_done",
            ProposalKind::Vote => "vote",
            ProposalKind::FactoryInfoUpdate { .. } => "factory_info_update",
            ProposalKind::ChangePolicyAddOrUpdateRole { .. } => "policy_add_or_update_role",
            ProposalKind::ChangePolicyRemoveRole { .. } => "policy_remove_role",
            ProposalKind::ChangePolicyUpdateDefaultVotePolicy { .. } => {
                "policy_update_default_vote_policy"
            }
            ProposalKind::ChangePolicyUpdateParameters { .. } => "policy_update_parameters",
        }
    }
}

/// Votes recorded in the proposal.
#[derive(Clone, Debug)]
#[near(serializers=[borsh(use_discriminant=true),json])]
pub enum Vote {
    Approve = 0x0,
    Reject = 0x1,
    Remove = 0x2,
}

impl From<Action> for Vote {
    fn from(action: Action) -> Self {
        match action {
            Action::VoteApprove => Vote::Approve,
            Action::VoteReject => Vote::Reject,
            Action::VoteRemove => Vote::Remove,
            _ => unreachable!(),
        }
    }
}

/// Proposal that are sent to this DAO.
#[near(serializers=[borsh, json])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
#[derive(Clone)]
#[serde(deny_unknown_fields)]
pub struct ProposalV1 {
    /// Original proposer.
    pub proposer: AccountId,
    /// Description of this proposal.
    pub description: String,
    /// Kind of proposal with relevant information.
    pub kind: ProposalKind,
    /// Current status of the proposal.
    pub status: ProposalStatus,
    /// Count of votes per role per decision: yes / no / spam.
    pub vote_counts: HashMap<String, [U128; 3]>,
    /// Map of who voted and how.
    pub votes: HashMap<AccountId, Vote>,
    /// Submission time (for voting period).
    pub submission_time: U64,
}

#[near(serializers=[borsh, json])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
#[derive(Clone)]
pub struct Proposal {
    /// Original proposer.
    pub proposer: AccountId,
    /// Description of this proposal.
    pub description: String,
    /// Kind of proposal with relevant information.
    pub kind: ProposalKind,
    /// Current status of the proposal.
    pub status: ProposalStatus,
    /// Count of votes per role per decision: yes / no / spam.
    pub vote_counts: HashMap<String, [U128; 3]>,
    /// Map of who voted and how.
    pub votes: HashMap<AccountId, Vote>,
    /// Submission time (for voting period).
    pub submission_time: U64,
    /// Last actions log
    pub last_actions_log: VecDeque<ProposalLog>,
}

impl From<ProposalV1> for Proposal {
    fn from(v1: ProposalV1) -> Self {
        Proposal {
            proposer: v1.proposer.clone(),
            description: v1.description.clone(),
            kind: v1.kind.clone(),
            status: v1.status.clone(),
            vote_counts: v1.vote_counts.clone(),
            votes: v1.votes.clone(),
            submission_time: v1.submission_time,
            last_actions_log: VecDeque::new(),
        }
    }
}

#[derive(Clone)]
#[near(serializers=[borsh])]
#[cfg_attr(not(target_arch = "wasm32"), derive(Debug))]
pub enum VersionedProposal {
    V1(ProposalV1),
    Latest(Proposal),
}

impl From<VersionedProposal> for ProposalV1 {
    fn from(v: VersionedProposal) -> Self {
        match v {
            VersionedProposal::V1(p) => p,
            _ => unimplemented!(),
        }
    }
}

impl From<VersionedProposal> for Proposal {
    fn from(v: VersionedProposal) -> Self {
        match v {
            VersionedProposal::V1(p) => p.into(),
            VersionedProposal::Latest(p) => p,
        }
    }
}

impl Proposal {
    pub fn update_votes(
        &mut self,
        account_id: &AccountId,
        roles: &[String],
        vote: Vote,
        policy: &Policy,
        user_weight: Balance,
    ) {
        for role in roles {
            let amount = if policy.is_token_weighted(role, &self.kind.to_policy_label().to_string())
            {
                user_weight
            } else {
                1
            };
            let defaults = [U128::from(0); 3];
            let vote_counted =
                self.vote_counts.entry(role.clone()).or_insert(defaults)[vote.clone() as usize].0
                    + amount;
            self.vote_counts
                .entry(role.clone())
                .and_modify(|votes| votes[vote.clone() as usize] = vote_counted.into());
        }
        assert!(
            self.votes.insert(account_id.clone(), vote).is_none(),
            "ERR_ALREADY_VOTED"
        );
    }
}

#[near(serializers=[json])]
pub struct ProposalInput {
    /// Description of this proposal.
    pub description: String,
    /// Kind of proposal with relevant information.
    pub kind: ProposalKind,
}

impl From<ProposalInput> for VersionedProposal {
    fn from(input: ProposalInput) -> Self {
        VersionedProposal::Latest(Proposal {
            proposer: env::predecessor_account_id(),
            description: input.description,
            kind: input.kind,
            status: ProposalStatus::InProgress,
            vote_counts: HashMap::default(),
            votes: HashMap::default(),
            submission_time: U64::from(env::block_timestamp()),
            last_actions_log: VecDeque::new(),
        })
    }
}

impl Contract {
    /// Execute payout of given token to given user.
    pub(crate) fn internal_payout(
        &mut self,
        token_id: &Option<AccountId>,
        receiver_id: &AccountId,
        amount: Balance,
        memo: String,
        msg: Option<String>,
    ) -> PromiseOrValue<()> {
        if token_id.is_none() {
            Promise::new(receiver_id.clone())
                .transfer(NearToken::from_yoctonear(amount))
                .into()
        } else {
            if let Some(msg) = msg {
                ext_fungible_token::ext(token_id.as_ref().unwrap().clone())
                    .with_attached_deposit(ONE_YOCTO_NEAR)
                    .with_static_gas(GAS_FOR_FT_TRANSFER)
                    .ft_transfer_call(receiver_id.clone(), U128(amount), Some(memo), msg)
            } else {
                ext_fungible_token::ext(token_id.as_ref().unwrap().clone())
                    .with_attached_deposit(ONE_YOCTO_NEAR)
                    .with_static_gas(GAS_FOR_FT_TRANSFER)
                    .ft_transfer(receiver_id.clone(), U128(amount), Some(memo))
            }
            .into()
        }
    }

    fn internal_return_bonds(&mut self, policy: &Policy, proposal: &Proposal) -> Promise {
        if let ProposalKind::BountyDone { .. } = &proposal.kind {
            self.locked_amount = self.locked_amount.saturating_sub(policy.bounty_bond);
            Promise::new(proposal.proposer.clone())
                .transfer(policy.bounty_bond)
                .detach();
        }

        self.locked_amount = self.locked_amount.saturating_sub(policy.proposal_bond);
        Promise::new(proposal.proposer.clone()).transfer(policy.proposal_bond)
    }

    /// Executes given proposal and updates the contract's state.
    fn internal_execute_proposal(
        &mut self,
        policy: &Policy,
        proposal: &Proposal,
        proposal_id: u64,
    ) -> PromiseOrValue<()> {
        let result = match &proposal.kind {
            ProposalKind::ChangeConfig { config } => {
                self.config.set(config);
                PromiseOrValue::Value(())
            }
            ProposalKind::ChangePolicy { policy } => {
                self.policy.set(policy);
                PromiseOrValue::Value(())
            }
            ProposalKind::AddMemberToRole { member_id, role } => {
                let mut new_policy = policy.clone();
                new_policy.add_member_to_role(role, member_id);
                self.policy.set(&VersionedPolicy::Current(new_policy));
                PromiseOrValue::Value(())
            }
            ProposalKind::RemoveMemberFromRole { member_id, role } => {
                let mut new_policy = policy.clone();
                new_policy.remove_member_from_role(role, member_id);
                self.policy.set(&VersionedPolicy::Current(new_policy));
                PromiseOrValue::Value(())
            }
            ProposalKind::FunctionCall {
                receiver_id,
                actions,
            } => {
                let mut promise = Promise::new(receiver_id.clone());
                for action in actions {
                    promise = promise.function_call(
                        action.method_name.clone(),
                        action.args.clone(),
                        action.deposit,
                        action.gas,
                    )
                }
                promise.into()
            }
            ProposalKind::UpgradeSelf { hash } => {
                upgrade_using_factory(hash);
                PromiseOrValue::Value(())
            }
            ProposalKind::UpgradeRemote {
                receiver_id,
                method_name,
                hash,
            } => {
                upgrade_remote(receiver_id, method_name, &hash.into());
                PromiseOrValue::Value(())
            }
            ProposalKind::Transfer {
                token_id,
                receiver_id,
                amount,
                msg,
            } => self.internal_payout(
                &convert_old_to_new_token(token_id),
                receiver_id,
                amount.0,
                proposal.description.clone(),
                msg.clone(),
            ),
            ProposalKind::SetStakingContract { staking_id } => {
                assert!(self.staking_id.is_none(), "ERR_INVALID_STAKING_CHANGE");
                self.staking_id = Some(staking_id.clone());
                PromiseOrValue::Value(())
            }
            ProposalKind::AddBounty { bounty } => {
                self.internal_add_bounty(bounty);
                PromiseOrValue::Value(())
            }
            ProposalKind::BountyDone {
                bounty_id,
                receiver_id,
            } => self.internal_execute_bounty_payout(*bounty_id, receiver_id, true),
            ProposalKind::Vote => PromiseOrValue::Value(()),
            ProposalKind::FactoryInfoUpdate { factory_info } => {
                internal_set_factory_info(factory_info);
                PromiseOrValue::Value(())
            }
            ProposalKind::ChangePolicyAddOrUpdateRole { role } => {
                let mut new_policy = policy.clone();
                new_policy.add_or_update_role(role);
                self.policy.set(&VersionedPolicy::Current(new_policy));
                PromiseOrValue::Value(())
            }
            ProposalKind::ChangePolicyRemoveRole { role } => {
                let mut new_policy = policy.clone();
                new_policy.remove_role(role);
                self.policy.set(&VersionedPolicy::Current(new_policy));
                PromiseOrValue::Value(())
            }
            ProposalKind::ChangePolicyUpdateDefaultVotePolicy { vote_policy } => {
                let mut new_policy = policy.clone();
                new_policy.update_default_vote_policy(vote_policy);
                self.policy.set(&VersionedPolicy::Current(new_policy));
                PromiseOrValue::Value(())
            }
            ProposalKind::ChangePolicyUpdateParameters { parameters } => {
                let mut new_policy = policy.clone();
                new_policy.update_parameters(parameters);
                self.policy.set(&VersionedPolicy::Current(new_policy));
                PromiseOrValue::Value(())
            }
        };
        match result {
            PromiseOrValue::Promise(promise) => promise
                .then(
                    Self::ext(env::current_account_id())
                        .with_static_gas(GAS_FOR_FT_TRANSFER)
                        .on_proposal_callback(proposal_id),
                )
                .into(),
            PromiseOrValue::Value(()) => self.internal_return_bonds(policy, proposal).into(),
        }
    }

    pub(crate) fn internal_callback_proposal_success(
        &mut self,
        proposal: &mut Proposal,
    ) -> PromiseOrValue<()> {
        let policy = self.policy.get().unwrap().to_policy();
        if let ProposalKind::BountyDone { bounty_id, .. } = proposal.kind {
            let mut bounty: Bounty = self.bounties.get(&bounty_id).expect("ERR_NO_BOUNTY").into();
            if bounty.times == 0 {
                self.bounties.remove(&bounty_id);
            } else {
                bounty.times -= 1;
                self.bounties
                    .insert(&bounty_id, &VersionedBounty::Default(bounty));
            }
        }
        proposal.status = ProposalStatus::Approved;
        self.internal_return_bonds(&policy, proposal).into()
    }

    pub(crate) fn internal_callback_proposal_fail(
        &mut self,
        proposal: &mut Proposal,
    ) -> PromiseOrValue<()> {
        proposal.status = ProposalStatus::Failed;
        PromiseOrValue::Value(())
    }

    /// Process rejecting proposal.
    fn internal_reject_proposal(
        &mut self,
        policy: &Policy,
        proposal: &Proposal,
        return_bonds: bool,
    ) -> PromiseOrValue<()> {
        if return_bonds {
            // Return bond to the proposer.
            self.internal_return_bonds(policy, proposal).detach();
        }

        let proposal_data = proposal;
        match &proposal_data.kind {
            ProposalKind::BountyDone {
                bounty_id,
                receiver_id,
            } => self.internal_execute_bounty_payout(*bounty_id, receiver_id, false),
            _ => PromiseOrValue::Value(()),
        }
    }

    pub(crate) fn internal_user_info(&self) -> UserInfo {
        let account_id = env::predecessor_account_id();
        UserInfo {
            amount: self.get_user_weight(&account_id),
            account_id,
        }
    }
}

#[near]
impl Contract {
    /// Add proposal to this DAO.
    #[payable]
    pub fn add_proposal(&mut self, proposal: ProposalInput) -> u64 {
        // 0. validate bond attached.
        // TODO: consider bond in the token of this DAO.
        let policy = self.policy.get().unwrap().to_policy();

        assert_eq!(
            env::attached_deposit(),
            policy.proposal_bond,
            "ERR_MIN_BOND"
        );

        // 1. Validate proposal.
        match &proposal.kind {
            ProposalKind::ChangePolicy { policy } => match policy {
                VersionedPolicy::Current(_) => {}
                _ => panic!("ERR_INVALID_POLICY"),
            },
            ProposalKind::Transfer { token_id, msg, .. } => {
                assert!(
                    token_id != OLD_BASE_TOKEN || msg.is_none(),
                    "ERR_BASE_TOKEN_NO_MSG"
                );
            }
            ProposalKind::SetStakingContract { .. } => assert!(
                self.staking_id.is_none(),
                "ERR_STAKING_CONTRACT_CANT_CHANGE"
            ),
            // TODO: add more verifications.
            _ => {}
        };

        // 2. Check permission of caller to add this type of proposal.
        assert!(
            policy
                .can_execute_action(
                    self.internal_user_info(),
                    &proposal.kind,
                    &Action::AddProposal
                )
                .1,
            "ERR_PERMISSION_DENIED"
        );

        // 3. Actually add proposal to the current list of proposals.
        let id = self.last_proposal_id;
        // 4. Log proposal creation
        let mut proposal = VersionedProposal::from(proposal).into();
        self.internal_log_action(id, Action::AddProposal, &mut proposal);

        self.proposals
            .insert(&id, &VersionedProposal::Latest(proposal));
        self.last_proposal_id += 1;
        self.locked_amount = self.locked_amount.saturating_add(env::attached_deposit());
        id
    }

    /// Act on given proposal by id, if permissions allow.
    /// Memo is logged but not stored in the state. Can be used to leave notes or explain the action.
    #[deny_unknown_arguments]
    pub fn act_proposal(
        &mut self,
        id: u64,
        action: Action,
        proposal: ProposalKind,
        memo: Option<String>,
    ) {
        let input_proposal_kind = proposal;
        // Convert proposal to the latest version
        let mut proposal: Proposal = self.proposals.get(&id).expect("ERR_NO_PROPOSAL").into();
        // Log the action
        self.internal_log_action(id, action.clone(), &mut proposal);

        let policy = self.policy.get().unwrap().to_policy();

        // Check permissions for the given action.
        let (roles, allowed) =
            policy.can_execute_action(self.internal_user_info(), &proposal.kind, &action);
        assert!(allowed, "ERR_PERMISSION_DENIED");
        let sender_id = env::predecessor_account_id();

        // Verify proposal kind
        assert!(proposal.kind == input_proposal_kind, "ERR_WRONG_KIND");
        // Update proposal given action. Returns true if should be updated in storage.
        let update = match action {
            Action::AddProposal => env::panic_str("ERR_WRONG_ACTION"),
            Action::RemoveProposal => {
                self.proposals.remove(&id);
                false
            }
            Action::VoteApprove | Action::VoteReject | Action::VoteRemove => {
                assert!(
                    matches!(proposal.status, ProposalStatus::InProgress),
                    "ERR_PROPOSAL_NOT_READY_FOR_VOTE"
                );
                proposal.update_votes(
                    &sender_id,
                    &roles,
                    Vote::from(action),
                    &policy,
                    self.get_user_weight(&sender_id),
                );

                // Updates proposal status with new votes using the policy.
                proposal.status =
                    policy.proposal_status(&proposal, roles, self.total_delegation_amount);
                if proposal.status == ProposalStatus::Approved {
                    self.internal_execute_proposal(&policy, &proposal, id)
                        .detach();
                    true
                } else if proposal.status == ProposalStatus::Removed {
                    self.internal_reject_proposal(&policy, &proposal, false)
                        .detach();
                    self.proposals.remove(&id);
                    false
                } else if proposal.status == ProposalStatus::Rejected {
                    self.internal_reject_proposal(&policy, &proposal, true)
                        .detach();
                    true
                } else {
                    // Still in progress or expired.
                    true
                }
            }
            // There are two cases when proposal must be finalized manually: expired or failed.
            // In case of failed, we just recompute the status and if it still approved, we re-execute the proposal.
            // In case of expired, we reject the proposal and return the bond.
            // Corner cases:
            //  - if proposal expired during the failed state - it will be marked as expired.
            //  - if the number of votes in the group has changed (new members has been added) -
            //      the proposal can loose it's approved state. In this case new proposal needs to be made, this one can only expire.
            Action::Finalize => {
                proposal.status = policy.proposal_status(
                    &proposal,
                    policy.roles.iter().map(|r| r.name.clone()).collect(),
                    self.total_delegation_amount,
                );
                match proposal.status {
                    ProposalStatus::Approved => {
                        self.internal_execute_proposal(&policy, &proposal, id)
                            .detach();
                    }
                    ProposalStatus::Expired => {
                        self.internal_reject_proposal(&policy, &proposal, true)
                            .detach();
                    }
                    _ => {
                        env::panic_str("ERR_PROPOSAL_NOT_EXPIRED_OR_FAILED");
                    }
                }
                true
            }
            Action::MoveToHub => false,
        };

        if update {
            self.proposals
                .insert(&id, &VersionedProposal::Latest(proposal));
        }
        if let Some(memo) = memo {
            log!("Memo: {}", memo);
        }
    }

    /// Receiving callback after the proposal has been finalized.
    /// If successful, returns bond money to the proposal originator.
    /// If the proposal execution failed (funds didn't transfer or function call failure),
    /// move proposal to "Failed" state.
    #[private]
    pub fn on_proposal_callback(&mut self, proposal_id: u64) -> PromiseOrValue<()> {
        let mut proposal: Proposal = self
            .proposals
            .get(&proposal_id)
            .expect("ERR_NO_PROPOSAL")
            .into();
        assert_eq!(
            env::promise_results_count(),
            1,
            "ERR_UNEXPECTED_CALLBACK_PROMISES"
        );
        let result = if utils::is_promise_success() {
            self.internal_callback_proposal_success(&mut proposal)
        } else {
            self.internal_callback_proposal_fail(&mut proposal)
        };
        self.proposals
            .insert(&proposal_id, &VersionedProposal::Latest(proposal));
        result
    }
}

`````

## sputnikdao2/src/ext_fungible_token.rs

Source: https://raw.githubusercontent.com/near-daos/sputnik-dao-contract/5434a59dec23ee0c49df8c8c4350c208a7e75b0b/sputnikdao2/src/ext_fungible_token.rs

`````rust
use near_sdk::{AccountId, PromiseOrValue, ext_contract, json_types::U128};

#[allow(dead_code)]
#[ext_contract(ext_fungible_token)]
pub trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128>;
}

`````

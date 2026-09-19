// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title MiniContract
/// @notice Escrow de ETH com liberação por marcos para um único transportador.
/// @dev Exemplo educacional. Faça revisão independente antes de usar valores reais.
contract MiniContract {
    error Unauthorized();
    error InvalidAddress();
    error InvalidMilestones();
    error InvalidIndex();
    error AlreadyCompleted();
    error AlreadyReleased();
    error NotCompleted();
    error DisputeActive();
    error NoBalance();
    error InsufficientFunds();
    error TransferFailed();
    error ReentrantCall();

    address public immutable owner;
    address public immutable carrier;
    uint256 public immutable totalValue;
    uint256 public released;
    bool public disputed;
    bool private locked;

    struct Milestone {
        string description;
        uint256 value;
        bool completed;
        bool released;
    }

    Milestone[] public milestones;

    event Deposited(address indexed from, uint256 amount);
    event MilestoneCompleted(uint256 indexed idx, address indexed by);
    event MilestoneReleased(uint256 indexed idx, uint256 amount);
    event DisputeRaised(address indexed by, string reason);
    event DisputeResolved(address indexed by);
    event Withdrawn(address indexed to, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyCarrier() {
        if (msg.sender != carrier) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert ReentrantCall();
        locked = true;
        _;
        locked = false;
    }

    constructor(
        address _carrier,
        string[] memory _descriptions,
        uint256[] memory _values
    ) {
        if (_carrier == address(0)) revert InvalidAddress();
        if (_descriptions.length == 0 || _descriptions.length != _values.length) {
            revert InvalidMilestones();
        }

        owner = msg.sender;
        carrier = _carrier;

        uint256 sum;
        for (uint256 i; i < _values.length; ++i) {
            if (_values[i] == 0) revert InvalidMilestones();
            sum += _values[i];
            milestones.push(
                Milestone({
                    description: _descriptions[i],
                    value: _values[i],
                    completed: false,
                    released: false
                })
            );
        }
        totalValue = sum;
    }

    /// @notice Recebe depósitos somente da empresa proprietária.
    receive() external payable onlyOwner {
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Deposita ETH para financiar os marcos.
    function deposit() external payable onlyOwner {
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice O transportador confirma a conclusão de um marco.
    function markMilestoneCompleted(uint256 idx) external onlyCarrier {
        if (idx >= milestones.length) revert InvalidIndex();
        Milestone storage milestone = milestones[idx];
        if (milestone.completed) revert AlreadyCompleted();

        milestone.completed = true;
        emit MilestoneCompleted(idx, msg.sender);
    }

    /// @notice O proprietário valida e paga um marco concluído.
    function releaseMilestone(uint256 idx) external onlyOwner nonReentrant {
        if (disputed) revert DisputeActive();
        if (idx >= milestones.length) revert InvalidIndex();

        Milestone storage milestone = milestones[idx];
        if (!milestone.completed) revert NotCompleted();
        if (milestone.released) revert AlreadyReleased();
        if (address(this).balance < milestone.value) revert InsufficientFunds();

        // Atualiza o estado antes da chamada externa.
        milestone.released = true;
        released += milestone.value;

        (bool success, ) = payable(carrier).call{value: milestone.value}("");
        if (!success) revert TransferFailed();
        emit MilestoneReleased(idx, milestone.value);
    }

    /// @notice Abre uma disputa e pausa liberações e saques.
    function raiseDispute(string calldata reason) external {
        if (msg.sender != owner && msg.sender != carrier) revert Unauthorized();
        if (disputed) revert DisputeActive();

        disputed = true;
        emit DisputeRaised(msg.sender, reason);
    }

    /// @notice Encerra a disputa. A resolução permanece sob responsabilidade do owner.
    /// @dev Em produção, substitua por árbitro/multisig ou mecanismo de arbitragem.
    function resolveDispute() external onlyOwner {
        if (!disputed) revert DisputeActive();
        disputed = false;
        emit DisputeResolved(msg.sender);
    }

    /// @notice Retira somente o saldo que exceder os compromissos ainda pendentes.
    function withdrawRemaining(address payable to) external onlyOwner nonReentrant {
        if (disputed) revert DisputeActive();
        if (to == address(0)) revert InvalidAddress();

        uint256 outstanding = totalValue - released;
        uint256 balance = address(this).balance;
        if (balance <= outstanding) revert NoBalance();

        uint256 amount = balance - outstanding;
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    function milestonesCount() external view returns (uint256) {
        return milestones.length;
    }
}

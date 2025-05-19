/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/speed_chess.json`.
 */
export type SpeedChess = {
  "address": "9z5kWJ5KSPfZXmCzv6cJyFXc6Y7tmsH5hj7SUy8aZji9",
  "metadata": {
    "name": "speedChess",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claimTimeoutWin",
      "discriminator": [
        175,
        234,
        101,
        151,
        53,
        30,
        177,
        137
      ],
      "accounts": [
        {
          "name": "chessMatch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  101,
                  115,
                  115,
                  95,
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "chess_match.match_id",
                "account": "chessMatch"
              }
            ]
          }
        },
        {
          "name": "claimerSigner",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "initializeMatch",
      "discriminator": [
        156,
        133,
        52,
        179,
        176,
        29,
        64,
        124
      ],
      "accounts": [
        {
          "name": "chessMatch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  101,
                  115,
                  115,
                  95,
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "arg",
                "path": "matchIdArg"
              }
            ]
          }
        },
        {
          "name": "playerSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "bettingTokenMintAccount"
        },
        {
          "name": "playerTokenAccount",
          "writable": true
        },
        {
          "name": "matchEscrowTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "matchIdArg"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "matchIdArg",
          "type": "string"
        },
        {
          "name": "betAmountArg",
          "type": "u64"
        },
        {
          "name": "moveTimeoutDurationArg",
          "type": "i64"
        },
        {
          "name": "platformFeeBasisPointsArg",
          "type": "u16"
        }
      ]
    },
    {
      "name": "joinMatch",
      "discriminator": [
        244,
        8,
        47,
        130,
        192,
        59,
        179,
        44
      ],
      "accounts": [
        {
          "name": "chessMatch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  101,
                  115,
                  115,
                  95,
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "chess_match.match_id",
                "account": "chessMatch"
              }
            ]
          }
        },
        {
          "name": "playerTwoSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "playerTokenAccount",
          "writable": true
        },
        {
          "name": "matchEscrowTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "chess_match.match_id",
                "account": "chessMatch"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "betAmountArg",
          "type": "u64"
        }
      ]
    },
    {
      "name": "makeMove",
      "discriminator": [
        78,
        77,
        152,
        203,
        222,
        211,
        208,
        233
      ],
      "accounts": [
        {
          "name": "chessMatch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  101,
                  115,
                  115,
                  95,
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "chess_match.match_id",
                "account": "chessMatch"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "makeMoveArgs"
            }
          }
        }
      ]
    },
    {
      "name": "processMatchSettlement",
      "discriminator": [
        236,
        106,
        133,
        178,
        45,
        221,
        98,
        116
      ],
      "accounts": [
        {
          "name": "chessMatch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  101,
                  115,
                  115,
                  95,
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "chess_match.match_id",
                "account": "chessMatch"
              }
            ]
          }
        },
        {
          "name": "matchEscrowTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "chess_match.match_id",
                "account": "chessMatch"
              }
            ]
          }
        },
        {
          "name": "playerOneAta",
          "writable": true
        },
        {
          "name": "playerTwoAta",
          "writable": true
        },
        {
          "name": "platformFeeAta",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "resignGame",
      "discriminator": [
        43,
        29,
        143,
        188,
        152,
        151,
        136,
        19
      ],
      "accounts": [
        {
          "name": "chessMatch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  101,
                  115,
                  115,
                  95,
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "chess_match.match_id",
                "account": "chessMatch"
              }
            ]
          }
        },
        {
          "name": "playerSigner",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "chessMatch",
      "discriminator": [
        72,
        241,
        122,
        67,
        252,
        229,
        79,
        237
      ]
    }
  ],
  "events": [
    {
      "name": "drawPayoutEvent",
      "discriminator": [
        204,
        185,
        220,
        244,
        158,
        169,
        10,
        187
      ]
    },
    {
      "name": "gameEndedEvent",
      "discriminator": [
        124,
        244,
        251,
        112,
        20,
        68,
        87,
        116
      ]
    },
    {
      "name": "matchCreatedEvent",
      "discriminator": [
        101,
        99,
        74,
        54,
        121,
        190,
        111,
        238
      ]
    },
    {
      "name": "moveMadeEvent",
      "discriminator": [
        116,
        181,
        208,
        158,
        192,
        84,
        32,
        251
      ]
    },
    {
      "name": "payoutEvent",
      "discriminator": [
        84,
        234,
        195,
        72,
        143,
        79,
        70,
        82
      ]
    },
    {
      "name": "playerJoinedEvent",
      "discriminator": [
        80,
        201,
        181,
        60,
        46,
        141,
        44,
        189
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidOwner",
      "msg": "The provided token account is not owned by the player."
    },
    {
      "code": 6001,
      "name": "invalidMint",
      "msg": "The provided token account's mint does not match the betting token mint."
    },
    {
      "code": 6002,
      "name": "invalidBetAmount",
      "msg": "The bet amount is invalid."
    },
    {
      "code": 6003,
      "name": "matchAlreadyFull",
      "msg": "The match is already full."
    },
    {
      "code": 6004,
      "name": "invalidMatchIdLength",
      "msg": "Match ID length is invalid or exceeds maximum allowed."
    },
    {
      "code": 6005,
      "name": "invalidPublicKeyString",
      "msg": "Invalid public key string format during parsing."
    },
    {
      "code": 6006,
      "name": "invalidPlatformFee",
      "msg": "Platform fee basis points exceed maximum (10000)."
    },
    {
      "code": 6007,
      "name": "unsupportedBettingToken",
      "msg": "Unsupported betting token mint. Only SEND or wSOL allowed."
    },
    {
      "code": 6008,
      "name": "invalidMoveOutOfBounds",
      "msg": "Invalid move: Coordinates out of bounds."
    },
    {
      "code": 6009,
      "name": "invalidMoveEmptySource",
      "msg": "Invalid move: Source square is empty."
    },
    {
      "code": 6010,
      "name": "invalidMoveNotYourPiece",
      "msg": "Invalid move: Not your piece to move."
    },
    {
      "code": 6011,
      "name": "invalidMoveCannotCaptureOwnPiece",
      "msg": "Invalid move: Cannot capture your own piece."
    },
    {
      "code": 6012,
      "name": "invalidMoveIllegalPieceMovement",
      "msg": "Invalid move: Illegal movement for this piece type."
    },
    {
      "code": 6013,
      "name": "invalidMovePathBlocked",
      "msg": "Invalid move: Path is blocked."
    },
    {
      "code": 6014,
      "name": "invalidMoveLeavesKingInCheck",
      "msg": "Invalid move: Move leaves king in check."
    },
    {
      "code": 6015,
      "name": "invalidPromotionPiece",
      "msg": "Invalid promotion: Specified piece type is not allowed for promotion."
    },
    {
      "code": 6016,
      "name": "invalidPromotionNotOnLastRank",
      "msg": "Invalid promotion: Pawn is not on the last rank for promotion."
    },
    {
      "code": 6017,
      "name": "invalidPromotionNotAPawn",
      "msg": "Invalid promotion: Only pawns can be promoted."
    },
    {
      "code": 6018,
      "name": "kingNotFound",
      "msg": "Internal error: King not found on the board."
    },
    {
      "code": 6019,
      "name": "invalidMatchId",
      "msg": "Invalid Match ID provided."
    },
    {
      "code": 6020,
      "name": "alreadyJoined",
      "msg": "You are already joined this match."
    },
    {
      "code": 6021,
      "name": "invalidEscrowAccount",
      "msg": "Invalid escrow account authority."
    },
    {
      "code": 6022,
      "name": "mathError",
      "msg": "Arithmetic operation overflow/underflow."
    },
    {
      "code": 6023,
      "name": "gameNotActive",
      "msg": "The game is not currently active."
    },
    {
      "code": 6024,
      "name": "notAPlayer",
      "msg": "The signer is not a registered player in this match."
    },
    {
      "code": 6025,
      "name": "notYourTurn",
      "msg": "It is not the signer's turn to move."
    },
    {
      "code": 6026,
      "name": "playerTimedOut",
      "msg": "Player has timed out."
    },
    {
      "code": 6027,
      "name": "matchAlreadyFullOrActive",
      "msg": "Match is already full or active, cannot join."
    },
    {
      "code": 6028,
      "name": "invalidMintForJoin",
      "msg": "The mint of your token account does not match the established betting token for this match."
    },
    {
      "code": 6029,
      "name": "cannotJoinOwnMatch",
      "msg": "Player cannot join their own match as the second player."
    },
    {
      "code": 6030,
      "name": "betAmountMismatch",
      "msg": "Joining bet amount does not match the creator's bet amount."
    },
    {
      "code": 6031,
      "name": "opponentNotJoinedYet",
      "msg": "Opponent has not joined the match yet, cannot determine winner by resignation."
    },
    {
      "code": 6032,
      "name": "notOpponentsTurnToClaimTimeout",
      "msg": "It is not the opponent's turn, so you cannot claim a timeout win yet."
    },
    {
      "code": 6033,
      "name": "timeoutNotConfigured",
      "msg": "Move timeout is not configured for this match."
    },
    {
      "code": 6034,
      "name": "opponentNotTimedOut",
      "msg": "Opponent has not actually timed out yet."
    },
    {
      "code": 6035,
      "name": "gameNotConcluded",
      "msg": "The game has not yet concluded."
    },
    {
      "code": 6036,
      "name": "payoutAlreadyProcessed",
      "msg": "Payout for this match has already been processed."
    },
    {
      "code": 6037,
      "name": "playerTokenAccountMismatch",
      "msg": "Player token account mismatch for payout."
    },
    {
      "code": 6038,
      "name": "platformTokenAccountError",
      "msg": "Platform fee token account mismatch or invalid mint for payout."
    },
    {
      "code": 6039,
      "name": "invalidGameStateForPayout",
      "msg": "Game state is invalid for processing a payout (e.g., winner does not exist)."
    }
  ],
  "types": [
    {
      "name": "castlingRights",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "whiteKingside",
            "type": "bool"
          },
          {
            "name": "whiteQueenside",
            "type": "bool"
          },
          {
            "name": "blackKingside",
            "type": "bool"
          },
          {
            "name": "blackQueenside",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "chessMatch",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "players",
            "type": {
              "array": [
                "pubkey",
                2
              ]
            }
          },
          {
            "name": "currentPlayerIdx",
            "type": "u8"
          },
          {
            "name": "currentTurn",
            "type": {
              "defined": {
                "name": "playerColor"
              }
            }
          },
          {
            "name": "lastMoveTimestamp",
            "type": "i64"
          },
          {
            "name": "moveTimeoutDuration",
            "type": "i64"
          },
          {
            "name": "gameStatus",
            "type": {
              "defined": {
                "name": "gameStatus"
              }
            }
          },
          {
            "name": "gameEndReason",
            "type": {
              "option": {
                "defined": {
                  "name": "gameEndReason"
                }
              }
            }
          },
          {
            "name": "board",
            "type": {
              "array": [
                {
                  "array": [
                    {
                      "option": {
                        "defined": {
                          "name": "piece"
                        }
                      }
                    },
                    8
                  ]
                },
                8
              ]
            }
          },
          {
            "name": "castlingRights",
            "type": {
              "defined": {
                "name": "castlingRights"
              }
            }
          },
          {
            "name": "enPassantTarget",
            "type": {
              "option": {
                "defined": {
                  "name": "enPassantSquare"
                }
              }
            }
          },
          {
            "name": "halfmoveClock",
            "type": "u8"
          },
          {
            "name": "fullmoveNumber",
            "type": "u16"
          },
          {
            "name": "bettingTokenMint",
            "type": "pubkey"
          },
          {
            "name": "betAmountPlayerOne",
            "type": "u64"
          },
          {
            "name": "betAmountPlayerTwo",
            "type": "u64"
          },
          {
            "name": "totalPot",
            "type": "u64"
          },
          {
            "name": "platformFeeBasisPoints",
            "type": "u16"
          },
          {
            "name": "payoutProcessed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "drawPayoutEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "whitePlayer",
            "type": "pubkey"
          },
          {
            "name": "blackPlayer",
            "type": "pubkey"
          },
          {
            "name": "amountEach",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "enPassantSquare",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "row",
            "type": "u8"
          },
          {
            "name": "col",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "gameEndReason",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "checkmate"
          },
          {
            "name": "stalemate"
          },
          {
            "name": "resignation"
          },
          {
            "name": "timeout"
          },
          {
            "name": "fiftyMoveRule"
          }
        ]
      }
    },
    {
      "name": "gameEndedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "gameStatus"
              }
            }
          },
          {
            "name": "winner",
            "type": {
              "option": {
                "defined": {
                  "name": "playerColor"
                }
              }
            }
          },
          {
            "name": "reason",
            "type": {
              "defined": {
                "name": "gameEndReason"
              }
            }
          }
        ]
      }
    },
    {
      "name": "gameStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "waitingForOpponent"
          },
          {
            "name": "active"
          },
          {
            "name": "whiteWins"
          },
          {
            "name": "blackWins"
          },
          {
            "name": "draw"
          }
        ]
      }
    },
    {
      "name": "makeMoveArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fromRow",
            "type": "u8"
          },
          {
            "name": "fromCol",
            "type": "u8"
          },
          {
            "name": "toRow",
            "type": "u8"
          },
          {
            "name": "toCol",
            "type": "u8"
          },
          {
            "name": "promotion",
            "type": {
              "option": {
                "defined": {
                  "name": "pieceType"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "matchCreatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "bettingTokenMint",
            "type": "pubkey"
          },
          {
            "name": "betAmount",
            "type": "u64"
          },
          {
            "name": "moveTimeoutDuration",
            "type": "i64"
          },
          {
            "name": "platformFeeBasisPoints",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "moveMadeEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "playerColor",
            "type": {
              "defined": {
                "name": "playerColor"
              }
            }
          },
          {
            "name": "algebraicMove",
            "type": "string"
          },
          {
            "name": "fromRow",
            "type": "u8"
          },
          {
            "name": "fromCol",
            "type": "u8"
          },
          {
            "name": "toRow",
            "type": "u8"
          },
          {
            "name": "toCol",
            "type": "u8"
          },
          {
            "name": "promotionPiece",
            "type": {
              "option": {
                "defined": {
                  "name": "pieceType"
                }
              }
            }
          },
          {
            "name": "boardFen",
            "type": "string"
          },
          {
            "name": "isCheck",
            "type": "bool"
          },
          {
            "name": "isCheckmate",
            "type": "bool"
          },
          {
            "name": "isStalemate",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "payoutEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "piece",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pieceType",
            "type": {
              "defined": {
                "name": "pieceType"
              }
            }
          },
          {
            "name": "color",
            "type": {
              "defined": {
                "name": "playerColor"
              }
            }
          }
        ]
      }
    },
    {
      "name": "pieceType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pawn"
          },
          {
            "name": "knight"
          },
          {
            "name": "bishop"
          },
          {
            "name": "rook"
          },
          {
            "name": "queen"
          },
          {
            "name": "king"
          }
        ]
      }
    },
    {
      "name": "playerColor",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "white"
          },
          {
            "name": "black"
          }
        ]
      }
    },
    {
      "name": "playerJoinedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "playerOne",
            "type": "pubkey"
          },
          {
            "name": "playerTwo",
            "type": "pubkey"
          },
          {
            "name": "bettingTokenMint",
            "type": "pubkey"
          },
          {
            "name": "betAmountPerPlayer",
            "type": "u64"
          }
        ]
      }
    }
  ]
};

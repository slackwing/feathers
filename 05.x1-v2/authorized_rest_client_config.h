//
// Created by Andrew Cheong on 5/6/22.
//

#include <string>
#include "enum_with_default_constructors.h"

#ifndef INC_05___X1_2_AUTHORIZEDRESTCLIENTCONFIG_H
#define INC_05___X1_2_AUTHORIZEDRESTCLIENTCONFIG_H

BETTER_ENUM(Signer, uint8_t, UNSET, HMAC_SHA256, HMAC_SHA384)

BETTER_ENUM(TimestampFormat, uint8_t, UNSET, EPOCH_MILLISECONDS, EPOCH_SECONDS)

BETTER_ENUM(Encoding, uint8_t, UNSET, BASE64)

BETTER_ENUM(NonceFormat, uint8_t, UNSET, UUID_V4)

struct AuthorizedRestClientConfig {
//    AuthorizedRestClientConfig() :
//            auth_signer{better_enums_data_AuthSigner::UNSET},
//            required_query_timestamp_format{better_enums_data_TimestampFormat::UNSET},
//            required_header_api_nonce_format{better_enums_data_NonceFormat::UNSET},
//            required_header_timestamp_format{better_enums_data_TimestampFormat::UNSET},
//            required_header_passphrase_signer{better_enums_data_AuthSigner::UNSET},
//            required_header_payload_encoding{better_enums_data_Encoding::UNSET}
//    {}
    std::string name;

    std::string api_domain; // e.g. foo.com, no https:// // done
    std::string api_base_path; // e.g. /api // done
    std::string api_version; // e.g. 2, no "v" // done
    std::string api_url_formatter; // done
    std::string api_key; // done
    std::string api_key_formatter; // done

    std::string secret_key; // done
    Encoding secret_key_encoding; // done
    std::string unsigned_msg_formatter; // done
    Signer signer; // done

    std::string required_query_api_key_param; // done
    std::string required_query_timestamp_param; // done
    TimestampFormat required_query_timestamp_format; // done
    std::string required_query_signed_msg_param; // done

    std::string required_header_api_key_key; // done
    std::string required_header_api_version_key; // done
    std::string required_header_api_version_value; // done
    std::string required_header_api_nonce_key;
    NonceFormat required_header_api_nonce_format;
    std::string required_header_timestamp_key; // done
    TimestampFormat required_header_timestamp_format; // done
    std::string required_header_api_signed_msg_key; // done
    std::string required_header_passphrase_key; // done
    std::string required_header_passphrase_value; // done
    Signer required_header_passphrase_signer; // done
    Encoding required_header_passphrase_encoding; // done
    std::string required_header_payload_key;
    Encoding required_header_payload_encoding;
    std::string required_header_custom_1;
};

#endif //INC_05___X1_2_AUTHORIZEDRESTCLIENTCONFIG_H

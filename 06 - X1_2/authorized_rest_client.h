//
// Created by Andrew Cheong on 5/6/22.
//

#include <iostream>
#include <cpr/cpr.h>
#include <string>
#include <sstream>
#include <regex>
#include <openssl/sha.h>
#include <openssl/hmac.h>
#include <boost/format.hpp>
#include "authorized_rest_client_config.h"
#include "base64.h"

#ifndef INC_05___X1_2_AUTHORIZEDRESTCLIENT_H
#define INC_05___X1_2_AUTHORIZEDRESTCLIENT_H

using strmap = std::map<std::string, std::string>;

class AuthorizedRestClient {

public:

    AuthorizedRestClient(AuthorizedRestClientConfig config) {
        config_ = config;
    }

    // TODO(5): consider a type here, e.g. Endpoint, which returns a templated type
    /**
     *  On the organization of this function: Each tier has at least one dependent on a previous tier.
     *  Put computed local vars at the top of each tier.
     *  Order in order as configuration.
     */
    void send(std::string method, std::string path) {

        strmap query_params;
        cpr::Header header;

        /**************************************************************************************************************/

        std::string computed_secret_key = config_.secret_key;
        std::string computed_timestamp;

        if (!config_.required_header_api_version_key.empty()) {
            header[config_.required_header_api_version_key] =
                    config_.required_header_api_version_value;
        }

        if (config_.secret_key_encoding != +better_enums_data_Encoding::UNSET) {
            computed_secret_key = decode(std::string_view{computed_secret_key}, Encoding::BASE64);
        }

        if (!config_.required_query_timestamp_param.empty()) {
            if (config_.required_query_timestamp_format == +TimestampFormat::UNSET) {
                // TODO: error
            } else {
                computed_timestamp = getTimestamp(config_.required_query_timestamp_format);
                query_params[config_.required_query_timestamp_param] = computed_timestamp;
            }
        }

        if (!config_.required_header_timestamp_key.empty()) {
            if (config_.required_header_timestamp_format == +TimestampFormat::UNSET) {
                // TODO: error
            } else {
                computed_timestamp = getTimestamp(config_.required_header_timestamp_format);
                header[config_.required_header_timestamp_key] = computed_timestamp;
            }
        }

        if (!config_.required_header_passphrase_key.empty()) {
            std::string computed_passphrase = config_.required_header_passphrase_value;
            std::cout << "configured: " << computed_passphrase << std::endl;
            if (config_.required_header_passphrase_signer != +better_enums_data_Signer::UNSET) {
                std::cout << "hmac-sha'ing with " << computed_secret_key << std::endl;
                computed_passphrase = getHmacSha(
                        computed_secret_key,
                        std::string_view{computed_passphrase},
                        config_.required_header_passphrase_signer);
                std::cout << "hmac-sha'd: " << computed_passphrase << std::endl;
            }
            if (config_.required_header_passphrase_encoding != +better_enums_data_Encoding::UNSET) {
                computed_passphrase = encode(std::string_view{computed_passphrase}, Encoding::BASE64);
                std::cout << "base64'd: " << computed_passphrase << std::endl;
            }
            header[config_.required_header_passphrase_key] = computed_passphrase;
        }

        /**************************************************************************************************************/

        // $vars that can be interpolated
        strmap interpolatable_vars;
        // interpolatable vars that match configuration keys exactly; order same as configuration keys
        interpolatable_vars["api_domain"] = config_.api_domain;
        interpolatable_vars["api_base_path"] = config_.api_base_path;
        interpolatable_vars["api_version"] = config_.api_version;
        interpolatable_vars["api_key"] = config_.api_key;
        // interpolation vars made available in this function (passed in or computed); order alphabetically
        interpolatable_vars["body"] = "";
        interpolatable_vars["timestamp"] = computed_timestamp;
        interpolatable_vars["method"] = method;
        interpolatable_vars["path"] = path;
        interpolatable_vars["payload"] = ""; // TODO

        /**************************************************************************************************************/

        std::string computed_api_url;
        std::string computed_api_key;
        std::string computed_unsigned_msg;
        std::string computed_signed_msg;

        if (!config_.api_url_formatter.empty()) {
            computed_api_url = interpolate(config_.api_url_formatter, interpolatable_vars);
        }

        computed_api_key = config_.api_key;
        if (!config_.api_key_formatter.empty()) {
            computed_api_key = interpolate(computed_api_key, interpolatable_vars);
        }

        if (!config_.unsigned_msg_formatter.empty()) {
            computed_unsigned_msg = interpolate(config_.unsigned_msg_formatter, interpolatable_vars);
            std::cout << "Interpolated unsigned message: " << computed_unsigned_msg << std::endl;
        }

        if (config_.signer == +better_enums_data_Signer::UNSET) {
            // TODO: error
        } else {
            computed_signed_msg = getHmacSha(
                    computed_secret_key,
                    std::string_view{computed_unsigned_msg},
                    config_.signer);
            std::cout << "Signed message: " << computed_signed_msg << std::endl;
        }

        /**************************************************************************************************************/

        if (!config_.required_query_api_key_param.empty()) {
            query_params[config_.required_query_api_key_param] = computed_api_key;
        }

        if (!config_.required_query_signed_msg_param.empty()) {
            query_params[config_.required_query_signed_msg_param] = computed_signed_msg;
        }

        if (!config_.required_header_api_key_key.empty()) {
            header[config_.required_header_api_key_key] = computed_api_key;
        }

        if (!config_.required_header_api_signed_msg_key.empty()) {
            header[config_.required_header_api_signed_msg_key] = computed_signed_msg;
        }

        /**************************************************************************************************************/

        std::stringstream computed_api_url_and_params;

        computed_api_url_and_params << computed_api_url;
        if (computed_api_url.back() == '/') computed_api_url_and_params.seekp(-1, std::ios_base::end); // strip trailing slash
        computed_api_url_and_params << path;

        bool first_param = true;
        for (const auto& [key, value] : query_params) {
            computed_api_url_and_params << (first_param ? "?" : "&");
            first_param = false;
            computed_api_url_and_params << key << value;
        }

        std::cout << "Target:" << std::endl;
        std::cout << "    " << computed_api_url_and_params.str() << std::endl;

        // TODO header["Accept"] = "application/json";

        std::cout << "Headers:" << std::endl;
        for (const auto& [key, value] : header) {
            std::cout << "    " << key << ": " << value << std::endl;
        }

        cpr::Response r = cpr::Get(
                cpr::Url{computed_api_url_and_params.str()},
                cpr::Header{header}/*,
                cpr::VerifySsl{false}*/);

//        cpr::Response r = cpr::Post(
//                cpr::Url{target.str()},
//                cpr::Header{header});

        std::cout << "Response Error: " << r.error.message << std::endl;
        std::cout << "Response Error Code: " << (int)r.error.code << std::endl;
        std::cout << "Response Status Code: " << r.status_code << std::endl;
        std::cout << "Response Text: " << std::endl;
        std::cout << "    " << r.text << std::endl;
    }

private:

    std::string interpolate(std::string format, strmap vars) {
        std::regex re{"[$](?:(\\w+)|[{](\\w+)[}])"};
        std::string out;
        std::string::const_iterator it = format.cbegin(), end = format.cend();
        for (std::smatch match; std::regex_search(it, end, match, re); it = match[0].second) {
            std::string interpolatable_var = match.str(1).empty() ? match.str(2) : match.str(1);
            if (vars.contains(interpolatable_var)) {
                out += match.prefix();
                out += vars[interpolatable_var];
            } else {
                out += match.prefix();
                out += match.str();
            }
        }
        return out;
    }

    std::string getTimestamp(TimestampFormat format) {
        std::time_t now = std::time(nullptr);
        std::stringstream timestamp;
        switch (format) {
            case TimestampFormat::EPOCH_SECONDS:
                timestamp << now;
                break;
            case TimestampFormat::EPOCH_MILLISECONDS:
                timestamp << now << "000";
                break;
            default:
                // todo(3)
                break;
        }
        return timestamp.str();
    }

    // https://stackoverflow.com/a/72065940/925913
    std::string getHmacSha(std::string_view decodedKey, std::string_view msg, Signer signer)
    {
        const EVP_MD* evp_md;
        switch (signer) {
            case Signer::HMAC_SHA256:
                evp_md = EVP_sha256();
                break;
            case Signer::HMAC_SHA384:
                evp_md = EVP_sha384();
                break;
            default:
                // todo(3)
                evp_md = EVP_sha256();
                break;
        }

        std::array<unsigned char, EVP_MAX_MD_SIZE> hash;
        unsigned int hashLen;
        HMAC(
                evp_md,
                decodedKey.data(),
                static_cast<int>(decodedKey.size()),
                reinterpret_cast<unsigned char const*>(msg.data()),
                static_cast<int>(msg.size()),
                hash.data(),
                &hashLen
        );
        std::stringstream out;
        for (unsigned int i=0; i < hashLen; i++) {
            out << boost::format("%02x") % (int)hash.data()[i];
        }
        return out.str();
    }

    std::string encode(std::string_view decoded, Encoding encoder) {
        switch (encoder) {
            case Encoding::BASE64:
                return base64_encode(decoded);
            default:
                return "";
        }
    }

    std::string decode(std::string_view decoded, Encoding encoder) {
        switch (encoder) {
            case Encoding::BASE64:
                return base64_decode(decoded);
            default:
                return "";
        }
    }

    AuthorizedRestClientConfig config_;
};

#endif //INC_05___X1_2_AUTHORIZEDRESTCLIENT_H

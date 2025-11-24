local home = os.getenv('HOME')
local jdtls = require('jdtls')
local lombok_jar = home .. '/.local/share/nvim/mason/packages/jdtls/lombok.jar'

local config = {
  cmd = {
    'java',
    '-Declipse.application=org.eclipse.jdt.ls.core.id1',
    '-Dosgi.bundles.defaultStartLevel=4',
    '-Declipse.product=org.eclipse.jdt.ls.core.product',
    '-Dlog.protocol=true',
    '-Dlog.level=ALL',
    '-Xmx1g',
    '-javaagent:' .. lombok_jar,
    '-jar', vim.fn.glob(home .. '/.local/share/nvim/mason/packages/jdtls/plugins/org.eclipse.equinox.launcher_*.jar'),
    '-configuration', home .. '/.local/share/nvim/mason/packages/jdtls/config_mac',
    '-data', vim.fn.expand('~/.cache/jdtls-workspace') .. vim.fn.getcwd():gsub("/", "_"),
  },
  root_dir = vim.fs.dirname(vim.fs.find({'gradlew', '.git', 'mvnw'}, { upward = true })[1]),
  settings = {
    java = {
      configuration = {
        runtimes = {
          {
            name = "JavaSE-21",
            path = "/Library/Java/JavaVirtualMachines/amazon-corretto-21.jdk/Contents/Home",
          },
        }
      },
      -- Adding the import and code generation settings. I don't know if any of the below (up to --x) worked.
      completion = {
        importOrder = {
          -- Packages that should show up first.
          "java",
          "javax",
          "com",
          "org",
          -- Packages that weirdly show up first.
          "io.vavr.collection",
          -- The rest.
          "#"
        },
        favoriteStaticMembers = {
          "org.junit.jupiter.api.Assertions.*",
          "org.mockito.Mockito.*",
          "org.mockito.ArgumentMatchers.*",
          "org.mockito.Answers.*",
        },
        importOrderSort = true,
      },
      -- Less commonly used packages.
      filteredTypes = {
        "com.sun.*",
        "io.micrometer.shaded.*",
        "java.awt.*",
        "jdk.*", 
        "sun.*",
      },
      sources = {
        organizeImports = {
          starThreshold = 99999,
          staticStarThreshold = 99999,
        }
      },
      quickfix = {
        showAt = "line",
      },
      codeAction = {
        sortMembers = false,
        sortImports = true,
      }
      --x
    },
  },
}

-- config.on_attach = function(client, bufnr)
--   print('JDTLS attached')
-- end

jdtls.start_or_attach(config)

-- print("JDTLS command:")
-- print(vim.inspect(config.cmd))

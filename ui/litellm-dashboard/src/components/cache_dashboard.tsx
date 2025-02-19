import React, { useState, useEffect } from "react";
import {
  Card,
  Title,
  BarChart,
  Subtitle,
  Grid,
  Col,
  Select,
  SelectItem,
  DateRangePicker,
  DateRangePickerValue,
  MultiSelect,
  MultiSelectItem,
  Button,
  TabPanel,
  TabPanels,
  TabGroup,
  TabList,
  Tab,
  TextInput,
  Icon,
  Text,
} from "@tremor/react";

import {
  Button as Button2,
  message,
} from "antd";
import {
  RefreshIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/outline";
import {
    adminGlobalCacheActivity,
    cachingHealthCheckCall,
    healthCheckCall,
} from "./networking";

const formatDateWithoutTZ = (date: Date | undefined) => {
    if (!date) return undefined;
    return date.toISOString().split('T')[0];
  };


function valueFormatterNumbers(number: number) {
const formatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    notation: 'compact',
    compactDisplay: 'short',
});

return formatter.format(number);
}

interface CachePageProps {
    accessToken: string | null;
    token: string | null;
    userRole: string | null;
    userID: string | null;
    premiumUser: boolean;
}

interface cacheDataItem {
    api_key: string;
    model: string;
    cache_hit_true_rows: number;
    cached_completion_tokens: number;
    total_rows: number;
    generated_completion_tokens: number;
    call_type: string;

    // Add other properties as needed
  }


interface uiData {
    "name": string;
    "LLM API requests": number;
    "Cache hit": number;
    "Cached Completion Tokens": number;
    "Generated Completion Tokens": number;

}

interface CacheHealthResponse {
  status?: string;
  cache_type?: string;
  ping_response?: boolean;
  set_cache_response?: string;
  litellm_cache_params?: string;
  error?: {
    message: string;
    type: string;
    param: string;
    code: string;
  };
}

// Helper function to deep-parse a JSON string if possible
const deepParse = (input: any) => {
  let parsed = input;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return parsed;
    }
  }
  return parsed;
};

// New table-based clickable error field component following view_logs table style
const TableClickableErrorField: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const truncated = value.length > 50 ? value.substring(0, 50) + "..." : value;
  return (
    <tr
      onClick={() => setIsExpanded(!isExpanded)}
      className="cursor-pointer hover:bg-gray-50"
    >
      <td className="px-6 py-2 font-medium text-blue-600">{label}</td>
      <td className="px-6 py-2 text-gray-700">
        {isExpanded ? value : truncated}
      </td>
    </tr>
  );
};

// Updated HealthCheckDetails component using a table layout for error details
const HealthCheckDetails: React.FC<{ response: any }> = ({ response }) => {
  if (response.error) {
    // First parse the error field
    let errorData = deepParse(response.error);
    // If errorData.message is a JSON string, parse it further
    if (errorData && typeof errorData.message === "string") {
      const innerParsed = deepParse(errorData.message);
      if (innerParsed && typeof innerParsed === "object") {
        errorData = innerParsed;
      }
    }
    return (
      <div className="mt-4">
        <div className="flex items-center space-x-2 text-red-600 px-4">
          <XCircleIcon className="h-5 w-5" />
          <h3 className="text-lg font-medium">Cache Health Check Failed</h3>
        </div>
        <div className="mt-2 bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="text-lg font-medium">Error Details</h3>
          </div>
          <div className="p-4 overflow-auto">
            <table className="min-w-full">
              <tbody>
                <tr>
                  <td className="px-6 py-2 font-medium">Message</td>
                  <td className="px-6 py-2 text-gray-700">
                    {errorData.message}
                  </td>
                </tr>
                {Object.entries(errorData)
                  .filter(([key]) => key !== "message")
                  .map(([key, value]) => (
                    <TableClickableErrorField
                      key={key}
                      label={key}
                      value={String(value)}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // When the response is successful (i.e. no error), display the healthy details.
  return (
    <div className="mt-4">
      <div className="flex items-center space-x-2 text-green-600 px-4">
        <CheckCircleIcon className="h-5 w-5" />
        <h3 className="text-lg font-medium">Cache Health Check Passed</h3>
      </div>
      <div className="mt-2 bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium">Cache Configuration</h3>
        </div>
        <div className="p-4 space-y-2">
          <div className="flex">
            <span className="font-medium w-1/3">Status:</span>
            <span>{response.status}</span>
          </div>
          <div className="flex">
            <span className="font-medium w-1/3">Cache Type:</span>
            <span>{response.cache_type}</span>
          </div>
          <div className="flex">
            <span className="font-medium w-1/3">Ping Response:</span>
            <span>{String(response.ping_response)}</span>
          </div>
          <div className="flex">
            <span className="font-medium w-1/3">Set Cache Response:</span>
            <span>{response.set_cache_response}</span>
          </div>
        </div>
      </div>

      {response.litellm_cache_params && (
        <div className="mt-4 bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="text-lg font-medium">LiteLLM Cache Parameters</h3>
          </div>
          <pre className="p-4 bg-gray-50 text-sm overflow-auto rounded-b-lg">
            {JSON.stringify(deepParse(response.litellm_cache_params), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

const CacheDashboard: React.FC<CachePageProps> = ({
  accessToken,
  token,
  userRole,
  userID,
  premiumUser,
}) => {
  const [filteredData, setFilteredData] = useState<uiData[]>([]);
  const [selectedApiKeys, setSelectedApiKeys] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] =  useState<string[]>([]);
  const [data, setData] = useState<cacheDataItem[]>([]);
  const [cachedResponses, setCachedResponses] = useState("0");
  const [cachedTokens, setCachedTokens] = useState("0");
  const [cacheHitRatio, setCacheHitRatio] = useState("0");

  const [dateValue, setDateValue] = useState<DateRangePickerValue>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 
    to: new Date(),
  });

  const [lastRefreshed, setLastRefreshed] = useState("");
  const [healthCheckResponse, setHealthCheckResponse] = useState<any>("");

  useEffect(() => {
    if (!accessToken || !dateValue) {
      return;
    }
    const fetchData = async () => {
      const response = await adminGlobalCacheActivity(accessToken, formatDateWithoutTZ(dateValue.from), formatDateWithoutTZ(dateValue.to));
      setData(response);
    };
    fetchData();

    const currentDate = new Date();
    setLastRefreshed(currentDate.toLocaleString());
  }, [accessToken]);

    const uniqueApiKeys = Array.from(new Set(data.map((item) => item?.api_key ?? "")));
    const uniqueModels = Array.from(new Set(data.map((item) => item?.model ?? "")));
    const uniqueCallTypes = Array.from(new Set(data.map((item) => item?.call_type ?? "")));


  const updateCachingData = async (startTime:  Date | undefined, endTime:  Date | undefined) => {
    if (!startTime || !endTime || !accessToken) {
      return;
    }

    // the endTime put it to the last hour of the selected date
    endTime.setHours(23, 59, 59, 999);

    // startTime put it to the first hour of the selected date
    startTime.setHours(0, 0, 0, 0);

    let new_cache_data = await adminGlobalCacheActivity(
      accessToken,
      formatDateWithoutTZ(startTime),
      formatDateWithoutTZ(endTime)
    )

    setData(new_cache_data);
  
  }

  useEffect(() => {
    console.log("DATA IN CACHE DASHBOARD", data);
    let newData: cacheDataItem[] = data;
    if (selectedApiKeys.length > 0) {
      newData = newData.filter((item) => selectedApiKeys.includes(item.api_key));
    }

    if (selectedModels.length > 0) {
      newData = newData.filter((item) => selectedModels.includes(item.model));
    }

    /* 
    Data looks like this 
    [{"api_key":"147dba2181f28914eea90eb484926c293cdcf7f5b5c9c3dd6a004d9e0f9fdb21","call_type":"acompletion","model":"llama3-8b-8192","total_rows":13,"cache_hit_true_rows":0},
    {"api_key":"8c23f021d0535c2e59abb7d83d0e03ccfb8db1b90e231ff082949d95df419e86","call_type":"None","model":"chatgpt-v-2","total_rows":1,"cache_hit_true_rows":0},
    {"api_key":"88dc28d0f030c55ed4ab77ed8faf098196cb1c05df778539800c9f1243fe6b4b","call_type":"acompletion","model":"gpt-3.5-turbo","total_rows":19,"cache_hit_true_rows":0},
    {"api_key":"88dc28d0f030c55ed4ab77ed8faf098196cb1c05df778539800c9f1243fe6b4b","call_type":"aimage_generation","model":"","total_rows":3,"cache_hit_true_rows":0},
    {"api_key":"0ad4b3c03dcb6de0b5b8f761db798c6a8ae80be3fd1e2ea30c07ce6d5e3bf870","call_type":"None","model":"chatgpt-v-2","total_rows":1,"cache_hit_true_rows":0},
    {"api_key":"034224b36e9769bc50e2190634abc3f97cad789b17ca80ac43b82f46cd5579b3","call_type":"","model":"chatgpt-v-2","total_rows":1,"cache_hit_true_rows":0},
    {"api_key":"4f9c71cce0a2bb9a0b62ce6f0ebb3245b682702a8851d26932fa7e3b8ebfc755","call_type":"","model":"chatgpt-v-2","total_rows":1,"cache_hit_true_rows":0},
    */

    // What data we need for bar chat 
    // ui_data = [
    //     {
    //         name: "Call Type",
    //         Cache hit: 20,
    //         LLM API requests: 10,
    //     }
    // ]

    console.log("before processed data in cache dashboard", newData);

    let llm_api_requests = 0;
    let cache_hits = 0;
    let cached_tokens = 0;
    const processedData = newData.reduce((acc: uiData[], item) => {
        console.log("Processing item:", item);
        
        if (!item.call_type) {
          console.log("Item has no call_type:", item);
          item.call_type = "Unknown";
        }


        llm_api_requests += (item.total_rows || 0) - (item.cache_hit_true_rows || 0);
        cache_hits += item.cache_hit_true_rows || 0;
        cached_tokens += item.cached_completion_tokens || 0;
    
        const existingItem = acc.find(i => i.name === item.call_type);
        if (existingItem) {
          existingItem["LLM API requests"] += (item.total_rows || 0) - (item.cache_hit_true_rows || 0);
          existingItem["Cache hit"] += item.cache_hit_true_rows || 0;
          existingItem["Cached Completion Tokens"] += item.cached_completion_tokens || 0;
          existingItem["Generated Completion Tokens"] += item.generated_completion_tokens || 0;
        } else {
          acc.push({
            name: item.call_type,
            "LLM API requests": (item.total_rows || 0) - (item.cache_hit_true_rows || 0),
            "Cache hit": item.cache_hit_true_rows || 0,
            "Cached Completion Tokens": item.cached_completion_tokens || 0,
            "Generated Completion Tokens": item.generated_completion_tokens || 0
          });
        }
        return acc;
      }, []);
    
    // set header cache statistics 
    setCachedResponses(valueFormatterNumbers(cache_hits));
    setCachedTokens(valueFormatterNumbers(cached_tokens));
    let allRequests = cache_hits + llm_api_requests
    if (allRequests > 0) {
      let cache_hit_ratio = ((cache_hits / allRequests) * 100).toFixed(2);
      setCacheHitRatio(cache_hit_ratio);
    } else {
      setCacheHitRatio("0");
    }
  
    setFilteredData(processedData);

    console.log("PROCESSED DATA IN CACHE DASHBOARD", processedData);

  }, [selectedApiKeys, selectedModels, dateValue, data]);


const handleRefreshClick = () => {
  // Update the 'lastRefreshed' state to the current date and time
  const currentDate = new Date();
  setLastRefreshed(currentDate.toLocaleString());
};

const runCachingHealthCheck = async () => {
  try {
    message.info("Running cache health check...");
    setHealthCheckResponse("");
    const response = await cachingHealthCheckCall(accessToken !== null ? accessToken : "");
    console.log("CACHING HEALTH CHECK RESPONSE", response);
    setHealthCheckResponse(response);
  } catch (error: any) {
    console.error("Error running health check:", error);
    let errorData;
    if (error && error.message) {
      try {
        // Parse the error message which may contain a nested error layer.
        let parsedData = JSON.parse(error.message);
        // If the parsed object is wrapped (e.g. { error: { ... } }), unwrap it.
        if (parsedData.error) {
          parsedData = parsedData.error;
        }
        errorData = parsedData;
      } catch (e) {
        errorData = { message: error.message };
      }
    } else {
      errorData = { message: "Unknown error occurred" };
    }
    setHealthCheckResponse({ error: errorData });
  }
};

  return (        
    <TabGroup className="gap-2 p-8 h-full w-full mt-2 mb-8">
        <TabList className="flex justify-between mt-2 w-full items-center">
          <div className="flex">
            <Tab>Cache Analytics</Tab>
            <Tab>
              <pre>Cache Health</pre>
            </Tab>
          </div>

          <div className="flex items-center space-x-2">
            {lastRefreshed && <Text>Last Refreshed: {lastRefreshed}</Text>}
            <Icon
              icon={RefreshIcon} // Modify as necessary for correct icon name
              variant="shadow"
              size="xs"
              className="self-center"
              onClick={handleRefreshClick}
            />
          </div>
        </TabList>
        <TabPanels>
          <TabPanel>
          <Card>      
      <Grid numItems={3} className="gap-4 mt-4">
        <Col>
          <MultiSelect
            placeholder="Select API Keys"
            value={selectedApiKeys}
            onValueChange={setSelectedApiKeys}
          >
            {uniqueApiKeys.map((key) => (
              <MultiSelectItem key={key} value={key}>
                {key}
              </MultiSelectItem>
            ))}
          </MultiSelect>
        </Col>
        <Col>
          <MultiSelect
            placeholder="Select Models"
            value={selectedModels}
            onValueChange={setSelectedModels}
          >
            {uniqueModels.map((model) => (
              <MultiSelectItem key={model} value={model}>
                {model}
              </MultiSelectItem>
            ))}
          </MultiSelect>
        </Col>
        <Col>
          <DateRangePicker
          enableSelect={true} 
            value={dateValue}
            onValueChange={(value) => {
                setDateValue(value);
                updateCachingData(value.from, value.to);
              }}
            selectPlaceholder="Select date range"
          />
        </Col>
      </Grid>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          <Card>
            <p className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content">
              Cache Hit Ratio
            </p>
            <div className="mt-2 flex items-baseline space-x-2.5">
              <p className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                {cacheHitRatio}%
              </p>
              
            </div>
          </Card>
          <Card>
            <p className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content">
              Cache Hits
            </p>
            <div className="mt-2 flex items-baseline space-x-2.5">
              <p className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                {cachedResponses}
              </p>
              
            </div>
          </Card>
          
          <Card>
            <p className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content">
              Cached Tokens
            </p>
            <div className="mt-2 flex items-baseline space-x-2.5">
              <p className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                {cachedTokens}
              </p>
              
            </div>
          </Card>

      </div>

      <Subtitle className="mt-4">Cache Hits vs API Requests</Subtitle>
      <BarChart
        title="Cache Hits vs API Requests"
        data={filteredData}
        stack={true}
        index="name"
        valueFormatter={valueFormatterNumbers}
        categories={["LLM API requests", "Cache hit"]}
        colors={["sky", "teal"]}
        yAxisWidth={48}
      />

    <Subtitle className="mt-4">Cached Completion Tokens vs Generated Completion Tokens</Subtitle>
    <BarChart
        className="mt-6"
        data={filteredData}
        stack={true}
        index="name"
        valueFormatter={valueFormatterNumbers}
        categories={["Generated Completion Tokens", "Cached Completion Tokens"]}
        colors={["sky", "teal"]}
        yAxisWidth={48}
    />


      </Card>
          </TabPanel>
          <TabPanel>
            <Card className="mt-4">
              <Text>
                Cache health will run a very small request through API /cache/ping
                configured on litellm
              </Text>

              <Button onClick={runCachingHealthCheck} className="mt-4">
                Run cache health
              </Button>
              
              {healthCheckResponse && (
                <HealthCheckDetails response={healthCheckResponse} />
              )}
            </Card>
          </TabPanel>
        </TabPanels>
      </TabGroup>
  );
};

export default CacheDashboard;